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
const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD } = require('./config/config')
const { DBConnect } = require('./dbConnect')

const app = express()

app.get('/', (req, res) => {
    const db = DBConnect.connect('localhost')
    res.send('<h1>Hello World</h1>')
})

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`listening on port ${port}`))