#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/generated"
PACKAGE="com.brewandbrews.halloweenradio"
HOST="radio.brewandbrewsco.com"
START_URL="https://${HOST}/halloween-radio/"

rm -rf "$OUT"
mkdir -p \
  "$OUT/app/src/main/res/values" \
  "$OUT/app/src/main/res/xml" \
  "$OUT/app/src/main/res/drawable"

cat > "$OUT/settings.gradle" <<'EOF'
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = 'BrewBrewsHalloweenRadio'
include ':app'
EOF

cat > "$OUT/build.gradle" <<'EOF'
plugins {
    id 'com.android.application' version '9.4.0' apply false
}
EOF

cat > "$OUT/gradle.properties" <<'EOF'
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
EOF

cat > "$OUT/app/build.gradle" <<EOF
plugins {
    id 'com.android.application'
}

android {
    namespace '${PACKAGE}'
    compileSdk 36

    defaultConfig {
        applicationId '${PACKAGE}'
        minSdk 23
        targetSdk 36
        versionCode 1
        versionName '1.0.0'
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.7.3'
}
EOF

cat > "$OUT/app/src/main/res/values/colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="radio_black">#050403</color>
    <color name="radio_amber">#F39A35</color>
    <color name="radio_dark_amber">#8F390F</color>
</resources>
EOF

cat > "$OUT/app/src/main/res/values/strings.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Brew &amp; Brews Halloween Radio</string>
    <string name="launch_url">${START_URL}</string>
    <string name="provider_authority">${PACKAGE}.fileprovider</string>
    <string name="asset_statements">[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"https://${HOST}"}}]</string>
</resources>
EOF

cat > "$OUT/app/src/main/res/xml/filepaths.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="twa_splash" path="." />
</paths>
EOF

cat > "$OUT/app/src/main/res/drawable/ic_app_icon.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#050403" android:pathData="M0,0H108V108H0Z"/>
    <path android:fillColor="#2A1209" android:pathData="M54,7A47,47 0,1 0,54 101A47,47 0,1 0,54 7Z"/>
    <path android:fillColor="#0B0705" android:strokeColor="#F39A35" android:strokeWidth="2.5" android:pathData="M54,15A39,39 0,1 0,54 93A39,39 0,1 0,54 15Z"/>
    <path android:fillColor="#130C08" android:strokeColor="#8F390F" android:strokeWidth="2" android:pathData="M27,43H81V76H27Z"/>
    <path android:fillColor="#030302" android:strokeColor="#8F390F" android:strokeWidth="1.5" android:pathData="M34,49H74V61H34Z"/>
    <path android:fillColor="#F39A35" android:pathData="M38,54H70V56H38Z"/>
    <path android:fillColor="#090604" android:strokeColor="#F39A35" android:strokeWidth="2" android:pathData="M39,65A6,6 0,1 0,39 77A6,6 0,1 0,39 65Z"/>
    <path android:fillColor="#090604" android:strokeColor="#F39A35" android:strokeWidth="2" android:pathData="M69,65A6,6 0,1 0,69 77A6,6 0,1 0,69 65Z"/>
    <path android:fillColor="#00000000" android:strokeColor="#F39A35" android:strokeWidth="3" android:strokeLineCap="round" android:pathData="M34,42C40,25 47,19 54,19C61,19 68,25 74,42"/>
</vector>
EOF

cat > "$OUT/app/src/main/AndroidManifest.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="false"
        android:enableOnBackInvokedCallback="true"
        android:icon="@drawable/ic_app_icon"
        android:roundIcon="@drawable/ic_app_icon"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="false"
        android:manageSpaceActivity="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"
        android:theme="@android:style/Theme.Translucent.NoTitleBar">

        <meta-data
            android:name="asset_statements"
            android:resource="@string/asset_statements" />

        <activity
            android:name="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"
            android:exported="false">
            <meta-data
                android:name="android.support.customtabs.trusted.MANAGE_SPACE_URL"
                android:value="${START_URL}" />
        </activity>

        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true"
            android:label="@string/app_name">

            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:resource="@string/launch_url" />
            <meta-data
                android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR"
                android:resource="@color/radio_black" />
            <meta-data
                android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR"
                android:resource="@color/radio_black" />
            <meta-data
                android:name="android.support.customtabs.trusted.SPLASH_IMAGE_DRAWABLE"
                android:resource="@drawable/ic_app_icon" />
            <meta-data
                android:name="android.support.customtabs.trusted.SPLASH_SCREEN_BACKGROUND_COLOR"
                android:resource="@color/radio_black" />
            <meta-data
                android:name="android.support.customtabs.trusted.SPLASH_SCREEN_FADE_OUT_DURATION"
                android:value="250" />
            <meta-data
                android:name="android.support.customtabs.trusted.FILE_PROVIDER_AUTHORITY"
                android:value="@string/provider_authority" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="https"
                    android:host="${HOST}"
                    android:pathPrefix="/halloween-radio/" />
            </intent-filter>
        </activity>

        <activity
            android:name="com.google.androidbrowserhelper.trusted.FocusActivity"
            android:exported="false" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="@string/provider_authority"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/filepaths" />
        </provider>

        <service
            android:name="com.google.androidbrowserhelper.trusted.DelegationService"
            android:exported="true"
            tools:ignore="ExportedService">
            <intent-filter>
                <action android:name="android.support.customtabs.trusted.TRUSTED_WEB_ACTIVITY_SERVICE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </service>
    </application>
</manifest>
EOF

cat > "$ROOT/assetlinks.template.json" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "${PACKAGE}",
      "sha256_cert_fingerprints": [
        "PLAY_APP_SIGNING_SHA256_GOES_HERE"
      ]
    }
  }
]
EOF

cat > "$ROOT/store-config.json" <<EOF
{
  "appName": "Brew & Brews Halloween Radio",
  "applicationId": "${PACKAGE}",
  "targetSdk": 36,
  "minSdk": 23,
  "androidBrowserHelper": "2.7.3",
  "productionHost": "${HOST}",
  "startUrl": "${START_URL}",
  "digitalAssetLinksPath": "https://${HOST}/.well-known/assetlinks.json",
  "status": "TWA project generated; Play signing fingerprint and production host verification remain before store upload"
}
EOF

echo "Generated Android TWA project in: $OUT"
echo "Package: $PACKAGE"
echo "Start URL: $START_URL"
