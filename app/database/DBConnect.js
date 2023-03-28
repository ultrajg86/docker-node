const mysql = require('mysql')
const { database } = require('../config/config')

class DBConnect {

    // connection 관리를 위해서 static으로 선언
    static DBCONNECTIONPOOL = []

    static connect(dbName) {

        // 이미 연결된게 있는지 확인 후 연결된게 있을 경우 해당 connecion 리턴
        if (!(dbName in database)) throw new DataBaseError({ code: 'DB_MYSQL_UNKNOW', message: 'mysql connection unknow' })
        if (dbName in DBConnect.DBCONNECTIONPOOL) {
            console.log('Reuse Connection', dbName)
            return DBConnect.DBCONNECTIONPOOL[dbName]
        }

        const config = {
            ...database[dbName],
            connectionLimit: 1,
            multipleStatements: false, //해당 옵션을 사용할시에 injection 공격을 받을 수 있음.
            queryFormat: function (query, values) { // query 작성시 변수로 지정하기 위함. => WHERE seq=:seq AND name=:name
                // console.log('queryFormat', query, values)
                if (!values) return query
                const execQuery = query.replace(/\:(\w+)/g, function (txt, key) {
                    if (values.hasOwnProperty(key)) {
                        return this.escape(values[key])
                    }
                    return txt
                }.bind(this))
                // 실행될 QUERY
                console.log(`[SQL][EXEC QUERY] ${execQuery}`)
                return execQuery
            },
        }
        console.log('New Connection', dbName)
        const connection = mysql.createPool(config)

        // 연결된 내역 저장
        DBConnect.DBCONNECTIONPOOL[dbName] = new this(dbName, connection)
        return DBConnect.DBCONNECTIONPOOL[dbName]
    }

    // static async startTransaction() {
    //     for (const dbName in DBConnect.DBCONNECTIONPOOL) {
    //         const conn = DBConnect.DBCONNECTIONPOOL[dbName]
    //         await conn.startTransaction()
    //     }
    // }

    // static async commitTransaction() {
    //     for (const dbName in DBConnect.DBCONNECTIONPOOL) {
    //         const conn = DBConnect.DBCONNECTIONPOOL[dbName]
    //         await conn.commitTransaction()
    //     }
    // }

    // static async rollbackTransaction() {
    //     for (const dbName in DBConnect.DBCONNECTIONPOOL) {
    //         const conn = DBConnect.DBCONNECTIONPOOL[dbName]
    //         await conn.rollbackTransaction()
    //     }
    // }

    constructor(dbName, connection) {
        this.dbName = dbName
        this.connection = connection
        this.connectionWithTransaction = undefined
    }

    async release() {
        this.connection.end()
        delete DBConnect.DBCONNECTIONPOOL[this.dbName]
        console.log(`RELEASE ${this.dbName}`)
    }

    async getConnection() {
        this.connectionWithTransaction = await new Promise((res, rej) => {
            this.connection.getConnection((err, connection) => {
                if (err) return rej(err)
                return res(connection)
            })
        })
    }

    async startTransaction() {
        await this.getConnection()
        if (this.connectionWithTransaction === undefined) {
            throw new DataBaseError('Transaction Connection Undefined')
        }
        await new Promise((res, rej) => {
            this.connectionWithTransaction.beginTransaction((err) => {
                if (err) {
                    console.log(`${this.dbName} START TRANSACTION FAIL`)
                    return rej(err)
                }
                console.log(`${this.dbName} START TRANSACTION`)
                return res()
            })
        })
    }

    async commitTransaction() {
        await new Promise((res, rej) => {
            this.connectionWithTransaction.commit((err) => {
                console.log(`${this.dbName} COMMIT TRANSACTION`)
                this.connectionWithTransaction.release()
                this.connectionWithTransaction = undefined
                if (err) return rej(err)
                return res()
            })
        })
    }

    async rollbackTransaction() {
        await new Promise((res) => {
            console.log(`${this.dbName} ROLLBACK TRANSACTION`)
            this.connectionWithTransaction.rollback(res)
            this.connectionWithTransaction.release()
            this.connectionWithTransaction = undefined
        })
    }

    /**
     * @description queryFormat을 통해서 SQL Injection 적용
     * 
     *  --- sample
        const testData = await this.db.query(
            'SELECT * FROM gateway_partner_mapping WHERE partner_external_id=:partner_external_id',
            { partner_type: 'VOUCHER', partner_external_id: 'placem-live-commerce', active: 'TRUE' },
        )

        console.log('testData', testData)

     * @param {*} query 
     * @param {*} params 
     * @param {*} connectionWithTransaction 
     * @returns 
     */
    async query(query, params) {
        // console.log(`[SQL][QUERY] ${query} -- ${JSON.stringify(params)}`)
        const conn = this.connectionWithTransaction || this.connection
        return await new Promise((resolve, reject) => {
            conn.query(query, params, (err, results, fields) => {
                if (err) {
                    console.log(`[SQL][ERROR] ${err.name} ${err.message} ${err.stack}`)
                    return reject(err)
                }
                console.log(`[SQL][RESULTS] ${JSON.stringify(results)}`)
                return resolve(results)
            })
        })
    }

    // 단순 select만 처리 복한건 위에 query를 사용
    /**
     * @description where 사용방법
     *              1) where = {name:'hong', email:'tester@tablemanager.io'}
     *              2) conditions = Object.keys(where).map(it => `${it}=:${it}`) 에서 [`name=:name`, `email=:email`]로 변환
     *              3) queryFormat을 통해서 2)에서 만든 내용을 name='hong', email='tester@tablemanager.io'로 매핑
     *              -- 기존에는 순서대로 들어갈 값을 지정해야했지만, 해당 방법으론 key만 맞으면 순서와 상관없음
     *              ex) SELECT * FROM user WHERE user_id=:user_id and user_pw=:usr_pw 일 경우 where {usr_pw:'1111', user_id:'userrrr'}로 써도됨
     * @param {*} table 
     * @param {*} where 
     * @param {*} fields
     * @returns 
     */
    //async select(table, where = {}, { fields = ['*'], lock = false }) {
    async select(table, where = {}, fields = []) {
        console.log(`[SQL][SELECT] ${table} -- ${JSON.stringify(where)}`)

        console.log(fields.length)

        const selectFields = (Array.isArray(fields)) ? fields : fields.split(',').map(it => it.trim())
        console.log(selectFields)
        let conditions = []
        if (Object.keys(where).length > 0) {
            for (const w of Object.keys(where)) {
                const value = where[w]
                if (Array.isArray(value)) {
                    conditions.push(`${w} IN (:${w})`)
                } else {
                    conditions.push(`${w}=:${w}`)
                }
            }
        }

        let query = `SELECT ?? FROM ??`
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ')
        }
        query = mysql.format(query, [selectFields, table, where])
        return await this.query(query, where)
    }

    async insert(table, params) {
        console.log(`[SQL][INSERT] ${table} -- ${JSON.stringify(params)}`)
        if (params === undefined || Object.values(params).length < 1) {
            throw new DataBaseError({ code: 'DB_MYSQL_WHERE', message: 'INSERT params Undefined' })
        }
        const query = mysql.format(`INSERT INTO ?? (??) VALUES (?)`, [table, Object.keys(params), Object.values(params)])
        return await this.query(query, {})
    }

    async update(table, params, where) {
        console.log(`[SQL][UPDATE] ${table} -- ${JSON.stringify(params)}`)
        if (where === undefined || Object.values(where).length < 1) {
            throw new DataBaseError({ code: 'DB_MYSQL_WHERE', message: 'UPDATE Where Undefined' })
        }
        let query = `UPDATE ?? SET ? WHERE `
        const conditions = []
        for (const w of Object.keys(where)) {
            const value = where[w]
            if (Array.isArray(value)) {
                conditions.push(`${w} IN (:${w})`)
            } else {
                conditions.push(`${w}=:${w}`)
            }
        }
        query = mysql.format(query + conditions.join(' AND '), [table, params])
        return await this.query(query, where)
    }

    async delete(table, where) {
        console.log(`[SQL][DELETE] ${table} -- ${JSON.stringify(where)}`)
        if (where === undefined || Object.values(where).length < 1) {
            throw new DataBaseError({ code: 'DB_MYSQL_WHERE', message: 'UPDATE Where Undefined' })
        }
        const query = mysql.format(`DELETE FROM ?? WHERE ?`, [table, where])
        return await this.query(query, {})
    }

    raw(rawQuery) {
        return mysql.raw(rawQuery)
    }

}

class DataBaseError extends Error {
    constructor({ code, message }) {
        super(message)
        this.code = code
    }
}

module.exports = {
    DBConnect,
    DataBaseError,
}