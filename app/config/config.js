module.exports = {
    MONGO_IP: process.env.MONGO_IP || 'mongo',
    MONGO_PORT: process.env.MONGO_PORT || 27017,
    MONGO_USER: process.env.MONGO_USER,
    MONGO_PASSWORD: process.env.MONGO_PASSWORD,
    
    database: {
        localhost: {
            host: 'localhost',
            user: 'root',
            password: '1111',
            port: 3306,
            database: 'lead_db'
        },
    }
}