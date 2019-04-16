import { HEADERS } from './headers'
import {
  createDeadLetterQueueId,
  createDeadLetterRoutingKey,
  createDeadLetterExchangeId,
  assertMessagingExchange,
  createExchangeId
} from './utils'

export default class MessageConsumer {
  constructor(clientId, channelManager, requestIdHandler) {
    this.clientId = clientId
    this.channelManager = channelManager
    this.requestIdHandler = requestIdHandler
  }

  async listen(publisherId, routingKey, onMessageReceived, ) {
    return this.listenMultiple(publisherId, [routingKey], onMessageReceived)
  }

  async listenMultiple(publisherId, routingKeys, onMessageReceived) {
    await this.assertExchangeAndQueues(publisherId, routingKeys)

    const channel = await this.channelManager.getChannel()
    const queueId = this.getQueueId(publisherId)

    const messageCallback = msg => {
      const message = this.createMessageReceived(channel, msg)
      onMessageReceived(message)
    }

    return channel.consume(queueId, messageCallback).then(consumeReply => consumeReply.consumerTag)
  }

  async ackAll() {
    const channel = await this.channelManager.getChannel()
    channel.ackAll()
  }

  async close() {
    return this.channelManager.close()
  }

  async cancel(listenId) {
    const channel = await this.channelManager.getChannel()
    await channel.cancel(listenId)
    return true
  }

  async get(publisherId, routingKeys) {
    await this.assertExchangeAndQueues(publisherId, routingKeys)

    const channel = await this.channelManager.getChannel()
    const queueId = this.getQueueId(publisherId)
    const msg = await channel.get(queueId)
    if (msg) return this.createMessageReceived(channel, msg)
  }

  isConnected() {
    return this.channelManager.isConnected()
  }

  createMessageReceived(channel, msg) {
    const parsedContent = this.parseContent(msg)
    let error
    if (!parsedContent) {
      error = {
        message: 'Error parsing content: Invalid JSON'
      }
    }
    let receivedOptions = {
      correlationId: msg.properties.correlationId,
      messageId: msg.properties.messageId
    }
    if (msg.properties.headers) {
      receivedOptions = {
        ...receivedOptions,
        senderPlatform: msg.properties.headers[HEADERS.SenderPlatform],
        recipientStaticId: msg.properties.headers[HEADERS.RecipientStaticId],
        senderStaticId: msg.properties.headers[HEADERS.SenderStaticId],
        recipientPlatform: msg.properties.headers[HEADERS.RecipientPlatform],
        requestId: msg.properties.headers[HEADERS.RequestId]
      }
    }

    if (this.requestIdHandler) {
      this.requestIdHandler.set(receivedOptions.requestId)
    }

    return {
      routingKey: msg.fields.routingKey,
      content: parsedContent,
      options: receivedOptions,
      ack: () => channel.ack(msg),
      reject: () => channel.nack(msg, false, false),
      requeue: () => channel.nack(msg),
      error
    }
  }

  parseContent(msg) {
    try {
      return JSON.parse(msg.content.toString(msg.properties.contentEncoding))
    } catch (e) {
      return undefined
    }
  }

  async assertExchangeAndQueues(publisherId, routingKeys) {
    const channel = await this.channelManager.getChannel()

    const queueId = this.getQueueId(publisherId)
    const deadQueueId = createDeadLetterQueueId(publisherId)
    const deadRoutingKey = createDeadLetterRoutingKey(this.clientId)
    const deadExchangeId = createDeadLetterExchangeId(publisherId)

    const exchangeId = createExchangeId(publisherId)
    await assertMessagingExchange(channel, exchangeId)
    await channel.assertExchange(deadExchangeId, 'topic')

    // assert queue for incoming messages
    const queueOptions = {
      deadLetterExchange: deadExchangeId,
      deadLetterRoutingKey: deadRoutingKey,
      durable: true
    }
    await channel.assertQueue(queueId, queueOptions)

    for (const routingKey of routingKeys) {
      await channel.bindQueue(queueId, exchangeId, routingKey)
    }

    // assert exchange and queue for failed messages (same for all consumers of 1 publisher)
    await channel.assertQueue(deadQueueId, { durable: true })
    await channel.bindQueue(deadQueueId, deadExchangeId, deadRoutingKey)

    // disable old setup
    const oldQueueId = this.getOldQueueId(publisherId)
    await channel.unbindQueue(deadQueueId, publisherId, deadRoutingKey)
    for (const routingKey of routingKeys) {
      await channel.unbindQueue(oldQueueId, publisherId, routingKey)
    }
  }

  getQueueId(publisherId) {
    return `${this.clientId}.${publisherId}.queue`
  }

  getOldQueueId(publisherId) {
    return `${this.clientId}.${publisherId}`
  }
}
