const { connection, connect } = require('mongoose')
const { mongo } = require('./config')

class MongoConnect {
    // connection 관리를 위해서 static으로 선언
    static DBCONNECTIONPOOL = []

    static connect(dbName) {

        // 이미 연결된게 있는지 확인 후 연결된게 있을 경우 해당 connecion 리턴
        if (!(dbName in mongo)) throw new DataBaseError({ code: 'DB_MYSQL_UNKNOW', message: 'mysql connection unknow' })
        if (dbName in DBConnect.DBCONNECTIONPOOL) {
            console.log('Reuse Connection', dbName)
            return DBConnect.DBCONNECTIONPOOL[dbName]
        }

        if (process.env.NODE_ENV !== 'production') {
            mongoose.set('debug', true)
        }

        const config = mongo[dbName]
        mongoose.connect(config).then(() => console.log('Connected!'))
    }
}

const connectMongoDB = async () => {
    const {
        connected,
        connecting,
        disconnected,
        disconnecting
    } = connection.states

    switch (connection.readyState) {
        case disconnected:
        case disconnecting:
            await connect(mongo, { useUnifiedTopology: true })
            break
        case connecting:
            await new Promise((resolve, reject) => {
                connection.on('connected', (err) => {
                    if (err) return reject(err)
                    resolve()
                })
            })
            break
        case connected:
            console.log('MongoDB::reuse connection')
            break
    }

    return connection
}


const MongoDB = {
    connect: connectMongoDB,
    /**
     * @param {string} collectionName
     */
    collection: (collectionName) => connection.collection(collectionName, {}),
}

exports.MongoDB = MongoDB
