const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(logger('dev'))
app.use(express.json())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: false }))

app.use('/test', require('./routes/test'))

app.use(errorHandler)

module.exports = app

function errorHandler(err, req, res, next) {
  if (!err) {
    return next()
  }

  if (res.headersSent) {
    return next(err)
  }

  console.error(err.stack)
  res
    .status(500)
    .json({ error: err + '' })
    .end()
}
