const router = require('express-promise-router')()

router.post(
  '/',
  async (req, res) => {
    console.log(req.body);

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
