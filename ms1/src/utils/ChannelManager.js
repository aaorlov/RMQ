const AMQP = require('amqplib')
import { Mutex } from 'async-mutex'

export default class ChannelManager {
  amqpUrl
  onChannelCreated
  currentChannel
  currentConnection

  constructor(amqpHost, amqpUsername, amqpPassword) {
    this.amqpUrl = `amqp://${amqpUsername}:${amqpPassword}@${amqpHost}`
    this.connectionMutex = new Mutex()

    /* RabbitMQ returns a boolean flag when its buffer is full and it temporarily won't accept
    any new messages. RabbitMQ generates the "drain" event when some messages are processed and
    it gets enough free space to accept a new message. This flag keeps track of
    RabbitMQ buffer's state. */
    this.channelBufferFull = false
  }

  async getChannel() {
    if (this.channelBufferFull) {
      throw new Error('Unable to get a RabbitMQ channel, a buffer is full')
    }

    await this.connectionMutex.runExclusive(async () => {
      await this.establishChannelIfNotReady()
    })

    return this.currentChannel
  }

  isConnected = () => {
    return this.currentConnection !== null && this.currentChannel !== null
  }

  async close() {
    if (!this.currentConnection) return

    try {
      return await this.currentConnection.close()
    } catch (e) {
      throw new Error('Unable to close connection to RabbitMQ broker')
    }
  }

  setChannelConnectionCallback(callback) {
    this.onChannelCreated = callback
  }

  async establishChannelIfNotReady() {
    if (this.currentChannel) return

    try {
      if (!this.currentConnection) this.currentConnection = await this.createNewConnection()
      this.currentChannel = await this.createNewChannel()
    } catch (e) {
      throw new Error('Unable to connect to RabbitMQ broker')
    }
  }

  async createNewConnection() {
    const connection = await AMQP.connect(this.amqpUrl)
    await connection.on('error', this.resetConnection)
    await connection.on('close', this.resetConnection)

    return connection
  }

  async createNewChannel() {
    const channel = await this.currentConnection.createChannel()
    // It is needed to handle connections through events due to a debug in RabbitMQ: https://github.com/squaremo/amqp.node/issues/175
    await channel.on('error', this.onChannelError.bind(this))
    await channel.on('drain', this.onChannelBufferNotFull.bind(this))

    await this.callOnChannelCreatedCallback(channel)

    return channel
  }

  async callOnChannelCreatedCallback(channel) {
    if (!this.onChannelCreated) return

    try {
      await this.onChannelCreated(channel)
    } catch (e) {
      throw new Error('Error occurred while calling channel creation callback')
    }
  }

  resetConnection = () => {
    this.currentChannel = null
    this.currentConnection = null
  }

  onChannelError(e) {
    this.resetChannel()
  }

  onChannelBufferNotFull() {
    this.setBufferFull(false)
  }

  resetChannel() {
    this.currentChannel = null
  }
  setBufferFull(isFull) {
    this.channelBufferFull = isFull
  }
}
