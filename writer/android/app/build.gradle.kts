plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.daymeter.writer"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.daymeter.writer"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.2.0"
        buildConfigField("String", "DAYMETER_INGEST_SECRET", "\"6e88gLxiAKQAzk98F3mn2Lz4XAxeuNED_BgzDo0B5DY\"")
        buildConfigField("String", "DAYMETER_INGEST_URL", "\"https://daymeter-dashboard9.vercel.app/api/ingest/phone\"")
        buildConfigField("String", "DAYMETER_LIVE_INGEST_URL", "\"https://daymeter.vercel.app/api/ingest\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
