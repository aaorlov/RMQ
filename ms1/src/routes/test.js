const router = require('express-promise-router')()
import { MessagingFactory } from '../utils'

const publisher = MessagingFactory.createPublisher('publisher-id-test-exchange')

router.post(
  '/',
  async (req, res) => {
    await publisher.publish('test-event-routing-key', {
      recipient: 'recipient',
      type: 'type',
      payload: req.body
    })
    return res.status(200).json(req.body)
  }
)

/**
 * curl localhost:3100/patients
 */
router.get('/', async (req, res) => {
  const db = await getDb()

  return res.json(
    await db
      .collection(PATIENTS_COLLECTION)
      .find()
      .toArray()
  )
})

module.exports = router
