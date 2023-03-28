const logger = console.log

const startTime = process.hrtime.bigint()
let runTime = startTime

console.log = function (...message) {
    const used = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    const s = process.hrtime.bigint()
    const seconds = Number(s - runTime) / 1000000000
    const total = Number(s - startTime) / 1000000000
    runTime = s
    logger(...message, ' => ', used + ' MB / ' + seconds + ' seconds / ' + total + ' seconds')
}

const express = require('express')
const { CustomLogger, Logger } = require('./CustomLogger')
const { DBConnect } = require('./database/DBConnect')

const app = express()

// Logger.message('aalalalalal')

app.get('/', async (req, res) => {

    const db = DBConnect.connect('localhost')

    const test = await db.select('employee')
    console.log(test)

    db.release()

    res.send(JSON.stringify(test))

})

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`listening on port ${port}`))