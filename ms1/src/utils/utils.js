const uuid = require('uuid')

import { HEADERS } from './headers'

export const EXCHANGE_SUFFIX = '.exchange'
export const ALT_EXCHANGE_ID = `alternate${EXCHANGE_SUFFIX}`
export const ALT_QUEUE_ID = 'alternate-queue'

export const createDeadLetterExchangeId = publisherID => {
  return `${publisherID}.dead`
}

export const createDeadLetterQueueId = publisherID => {
  return `${publisherID}.dead`
}

export const createDeadLetterRoutingKey = clientId => {
  return `${clientId}.dead`
}

export const createExchangeId = publisherId => {
  return `${publisherId}${EXCHANGE_SUFFIX}`
}

export const createDefaultMessageOptions = () => ({
  contentEncoding: 'utf-8',
  contentType: 'application/json',
  persistent: true,
  timestamp: Date.now(),
  messageId: uuid()
})

export const createMessageOptions = providedOptions => {
  const defaultOptions = createDefaultMessageOptions()

  if (providedOptions.messageId) {
    defaultOptions.messageId = providedOptions.messageId
  }

  const headers = {}

  headers[HEADERS.RecipientStaticId] = providedOptions.recipientStaticId
  headers[HEADERS.SenderStaticId] = providedOptions.senderStaticId

  headers[HEADERS.SenderPlatform] = providedOptions.senderPlatform
  headers[HEADERS.RecipientPlatform] = providedOptions.recipientPlatform

  headers[HEADERS.RequestId] = providedOptions.requestId

  return {
    ...defaultOptions,
    correlationId: providedOptions.correlationId,
    headers
  }
}

/**
 * Asserts alternate exchange, a queue for the exchange, and a binding
 *
 * @param channel
 */
const assertAlternateExchange = async channel => {
  await channel.assertExchange(ALT_EXCHANGE_ID, 'fanout')
  await channel.assertQueue(ALT_QUEUE_ID)
  await channel.bindQueue(ALT_QUEUE_ID, ALT_EXCHANGE_ID, '')
}

/**
 * We want to assert both messaging and alternate exchanges in consumer and publisher so that:
 * 1) we don't loose any message if publisher starts publishing messages before a queue and a binding is created
 * 2) we can create an exchange-to-queue binding if consumer starts before publisher
 *
 * @param channel
 * @param exchangeId
 */
export const assertMessagingExchange = async (channel, exchangeId) => {
  try {
    await assertAlternateExchange(channel)
  } catch (e) {
    throw new Error(`Unable to create an alternate exchange`)
  }

  try {
    await channel.assertExchange(exchangeId, 'topic', { alternateExchange: ALT_EXCHANGE_ID })
  } catch (e) {
    throw new Error(`Unable to create exchange with ID '${exchangeId}'`)
  }
}
