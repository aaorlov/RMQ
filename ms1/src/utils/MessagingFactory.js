import ChannelManager from './ChannelManager'
import MessageConsumer from './MessageConsumer'
import MessagePublisher from './MessagePublisher'

export class MessagingFactory {
  constructor(amqpHost, amqpUsername, amqpPassword, requestIdHandler) {
    this.amqpHost = amqpHost
    this.amqpUsername = amqpUsername
    this.amqpPassword = amqpPassword
    this.requestIdHandler = requestIdHandler
  }

  /**
   * Creates a Consumer
   *
   * @param clientId consumer id that is used to register the consumer in RabbitMQ
   */
  createConsumer(clientId) {
    return new MessageConsumer(clientId, this.createChannelManager(), this.requestIdHandler)
  }

  /**
   * Creates a Publisher
   *
   * @param publisherId producer Id which is used to name the exchange in RabbitMQ
   */
  createPublisher(publisherId) {
    return new MessagePublisher(publisherId, this.createChannelManager(), this.requestIdHandler)
  }


  createChannelManager() {
    return new ChannelManager(this.amqpHost, this.amqpUsername, this.amqpPassword)
  }
}

export default new MessagingFactory(process.env.INTERNAL_MQ_HOST, process.env.INTERNAL_MQ_USERNAME, process.env.INTERNAL_MQ_PASSWORD)