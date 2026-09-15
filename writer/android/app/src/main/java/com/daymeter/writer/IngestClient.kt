package com.daymeter.writer

import java.net.HttpURLConnection
import java.net.URL

enum class IngestOutcome { UPLOADED, FAILED_FATAL, FAILED_RETRY }

object IngestConfig {
    fun originUrl(): String = BuildConfig.DAYMETER_INGEST_URL.trim()
    fun liveUrl(): String = BuildConfig.DAYMETER_LIVE_INGEST_URL.trim()
    fun secret(): String = BuildConfig.DAYMETER_INGEST_SECRET
    fun urls(): List<String> = listOf(liveUrl(), originUrl()).filter { it.isNotBlank() }.distinct()
    fun configured(): Boolean = urls().isNotEmpty() && secret().isNotBlank()
}

object HttpsPoster {
    fun post(url: String, secret: String, body: String, contentType: String): Int {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 15_000
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Content-Type", contentType)
        connection.setRequestProperty("Authorization", "Bearer $secret")
        connection.setRequestProperty("X-Daymeter-Secret", secret)
        val bytes = body.toByteArray(Charsets.UTF_8)
        connection.setFixedLengthStreamingMode(bytes.size)
        connection.outputStream.use { it.write(bytes) }
        val code = connection.responseCode
        connection.disconnect()
        return code
    }
}

object IngestClient {
    fun classify(httpCode: Int): IngestOutcome = when (httpCode) {
        in 200..299 -> IngestOutcome.UPLOADED
        400, 401, 403, 404, 405, 413, 422 -> IngestOutcome.FAILED_FATAL
        else -> IngestOutcome.FAILED_RETRY
    }

    fun upload(body: String, contentType: String): IngestOutcome {
        if (body.isBlank() || !IngestConfig.configured()) return IngestOutcome.FAILED_FATAL
        var sawRetry = false
        var anyOk = false
        for (url in IngestConfig.urls()) {
            val code = try {
                HttpsPoster.post(url, IngestConfig.secret(), body, contentType)
            } catch (_: Exception) {
                sawRetry = true
                continue
            }
            when (classify(code)) {
                IngestOutcome.UPLOADED -> anyOk = true
                IngestOutcome.FAILED_RETRY -> sawRetry = true
                IngestOutcome.FAILED_FATAL -> { /* try remaining hosts */ }
            }
        }
        return when {
            anyOk -> IngestOutcome.UPLOADED
            sawRetry -> IngestOutcome.FAILED_RETRY
            else -> IngestOutcome.FAILED_FATAL
        }
    }
}
