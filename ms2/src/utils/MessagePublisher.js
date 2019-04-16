import { createMessageOptions, assertMessagingExchange, createExchangeId } from './utils'

export default class MessagePublisher {
  HOUR = 1 * 60 * 60 * 1000
  constructor(publisherId, channelManager, requestIdHandler) {
    this.exchangeId = createExchangeId(publisherId)
    this.channelManager = channelManager
    this.requestIdHandler = requestIdHandler
    channelManager.setChannelConnectionCallback(this.onChannelCreated.bind(this))
  }

  async publish(routingKey, content, options, ttlMs = MessagePublisher.HOUR) {
    const messageOptions = this.createMessageOptions(options)
    messageOptions.expiration = ttlMs

    return this.publishMessage(routingKey, content, messageOptions)
  }

  async publishCritical(routingKey, content, options) {
    const messageOptions = this.createMessageOptions(options)

    return this.publishMessage(routingKey, content, messageOptions)
  }

  async close() {
    return this.channelManager.close()
  }

  async publishMessage(routingKey, content, messageOptions) {
    const channel = await this.channelManager.getChannel()

    const publishFlow = await channel.publish(
      this.exchangeId,
      routingKey,
      Buffer.from(JSON.stringify(content), messageOptions.contentEncoding),
      messageOptions
    )

    // If the publishFlow is false, that means that the buffer is full
    this.channelManager.setBufferFull(!publishFlow)

    return {
      controlFlow: publishFlow,
      messageId: messageOptions.messageId
    }
  }

  createMessageOptions(options) {
    return createMessageOptions({
      ...options,
      requestId: this.getRequestId(options)
    })
  }

  getRequestId(options) {
    if (options && options.requestId) {
      return options.requestId
    }
    if (this.requestIdHandler) {
      return this.requestIdHandler.get()
    }
    return undefined
  }

  /**
   * Assert an exchange and an alternate exchange once channel is created
   *
   * @param channel
   */
  async onChannelCreated(channel) {
    await assertMessagingExchange(channel, this.exchangeId)
  }
}
