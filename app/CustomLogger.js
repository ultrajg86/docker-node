const moment = require('moment')
const winston = require('winston')
const os = require('os')
const uuid = require('uuid')

class CustomLogger {
    constructor(traceUuid) {
        let serverIp = 'server-ip'
        Object.values(os.networkInterfaces()).forEach(networkInterfaces => {
            const serverIpNetworkInterface = networkInterfaces?.find(networkInterface => networkInterface.family === 'IPv4' && networkInterface.internal === false)
            if (serverIpNetworkInterface) serverIp = serverIpNetworkInterface.address
        })

        this.traceUuid = traceUuid
        this.logLevel = 'debug'
        this.logger = winston.createLogger({
            level: this.logLevel,
            format: winston.format.combine(
                winston.format.timestamp({ format: () => moment().format() }),
                winston.format.metadata({ fillExcept: ['message', 'timestamp', 'serverIp', 'level', 'traceUuid'] }),
                winston.format.printf((info) => {
                    return `[${info.timestamp}] [${info.serverIp}] ${info.level.toUpperCase()}: [${info.traceUuid}] ${info.message}`
                })
            ),
            defaultMeta: {
                serverIp,
                traceUuid,
            },
            transports: [
                new winston.transports.Console(),
            ],
        })
    }

    logRequestInfo(requestInfoLogContent) {
        const { requestHttpMethod, requestUrl, requestHeader = {}, requestBody = {} } = requestInfoLogContent
        this.logger.log(this.logLevel, `REQUEST = ${requestHttpMethod.toUpperCase()} ${requestUrl} header = ${JSON.stringify(requestHeader)} body = ${JSON.stringify(requestBody)}`)
    }

    logResponseInfo(responseInfoLogContent) {
        const { responseStatusCode, responseBody } = responseInfoLogContent
        this.logger.log(this.logLevel, `RESPONSE = status-code: ${responseStatusCode}, body = ${JSON.stringify(responseBody)}`)
    }

    logAPIRequestInfo(requestInfoLogContent) {
        const { requestHttpMethod, requestUrl, requestHeader = {}, requestBody = {} } = requestInfoLogContent
        this.logger.log(this.logLevel, `API_REQUEST = ${requestHttpMethod.toUpperCase()} ${requestUrl} header = ${JSON.stringify(requestHeader)} body = ${JSON.stringify(requestBody)}`)
    }

    logAPIResponseInfo(responseInfoLogContent) {
        const { responseStatusCode, responseBody } = responseInfoLogContent
        this.logger.log(this.logLevel, `API_RESPONSE = status-code: ${responseStatusCode}, body = ${JSON.stringify(responseBody)}`)
    }

    logSqlQueryString(sqlQueryStringLogContent) {
        const { queryString, queryParams = [] } = sqlQueryStringLogContent
        this.logger.log(this.logLevel, `QUERY_STRING = ${queryString} ${JSON.stringify(queryParams)}`)
    }

    logSqlQueryResult(sqlQueryResultLogContent) {
        this.logger.log(this.logLevel, `QUERY_RESULT = ${JSON.stringify(sqlQueryResultLogContent)}`)
    }

    logException(exception) {
        this.logger.log(this.logLevel, `EXCEPTION = ${JSON.stringify(exception)}`)
    }

    logCustomMessage(customMessage) {
        this.logger.log(this.logLevel, `MESSAGE = ${customMessage}`)
    }

    /**
     * console.log처럼 메세지를 모두 남기기위해서 lemon에서 가져옴.
     */
    log(...logMessage) {
        const msg = logMessage.map((log) => {
            let returnLog = log
            let typeOfLog = typeof log
            if (log instanceof Error) {
                // Error 메시지 출력
                returnLog = log.stack
            } else if (log === undefined) {
                returnLog = 'undefined'
            } else if (typeOfLog === 'object') {
                try {
                    returnLog = JSON.stringify(log)
                } catch (err) {
                    // Object의 경우 일부 실패 가능성이 있음
                    returnLog = '(Catch)LoggingFail:: ' + err.toString()
                }
            }
            return returnLog
        })
        this.logger.log(this.logLevel, msg.join(' || '))
    }

    static registerLoggerToSessionMiddleware(req, res, next) {
        const TRACE_HEADER_KEY = 'trace-key'
        const tradeKey = req.header(TRACE_HEADER_KEY) || uuid.v4()

        CustomLogger.instance = new CustomLogger(tradeKey)
        res.locals.customLogger = CustomLogger.instance

        next()
    }

    static requestLoggingMiddleware(req, res, next) {
        const customLogger = res.locals.customLogger

        customLogger.logRequestInfo({
            requestHttpMethod: req.method,
            requestUrl: req.url,
            requestHeader: req.headers,
            requestBody: req.body,
        })

        next()
    }

    static responseLoggingMiddleware(req, res, next) {
        const customLogger = res.locals.customLogger

        let responseBody = {}
        const originalSend = res.send
        res.send = (...args) => {
            responseBody = args[0]
            return originalSend.apply(res, args)
        }

        res.on('finish', () => {
            customLogger.logResponseInfo({
                responseStatusCode: res.statusCode,
                responseBody,
            })
        })

        next()
    }

}

/**
 * static getInstance() 라는걸로 만들어서 하고싶었지만. CustomLogger에 대해서 instance를 만들기전에 호출이 되기에 사용하지 않음
 * 그래서 CustomLogger의 instance가 만들어 진 후 해당 static 변수를 호출하여 로그를 남기도록 변경
 */
class Logger {

    /**
     * 현재 사용중인 trace id 가져오기
     */
    static traceUuid() {
        return CustomLogger.instance.traceUuid
    }

    /**
     * console처럼 로그 남기기
     */
    static message(...message) {
        CustomLogger.instance.log(message)
    }
}

export { CustomLogger, Logger }
// module.exports = { CustomLogger, Logger }
