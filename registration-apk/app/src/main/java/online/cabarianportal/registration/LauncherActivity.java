package online.cabarianportal.registration;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Browser-independent launcher for the household registration module.
 *
 * <p>The original Bubblewrap launcher delegated rendering to the user's default browser. This
 * activity intentionally renders the owned site in Android System WebView so Chrome, Samsung
 * Internet, or another browser does not need to be installed or selected.</p>
 *
 * <p>Do not run {@code bubblewrap update} without restoring this file afterwards because the
 * Bubblewrap generator replaces its Android launcher template.</p>
 */
public class LauncherActivity extends Activity {
    private static final String LOG_TAG = "CabarianRegistration";
    private static final String APP_HOST = "cabarianportal.online";
    private static final String APP_PATH_PREFIX = "/household-system/";
    private static final String START_URL =
            "https://cabarianportal.online/household-system/registration.php";
    private static final long PAGE_LOAD_TIMEOUT_MS = 30_000L;
    private static final long CAMERA_CACHE_CLEANUP_DELAY_MS = 2 * 60_000L;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1201;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ArrayList<File> cameraTempFiles = new ArrayList<>();
    private final Runnable cameraCacheCleanup = this::deleteCompletedCameraFiles;

    private FrameLayout rootView;
    private WebView webView;
    private View loadingView;
    private View errorView;
    private TextView errorMessageView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private Uri pendingCameraUri;
    private File pendingCameraFile;
    private boolean pageLoading;
    private boolean mainFrameFailed;
    private String lastRequestedUrl = START_URL;

    private final Runnable pageLoadTimeout = new Runnable() {
        @Override
        public void run() {
            if (!pageLoading || webView == null) {
                return;
            }

            pageLoading = false;
            webView.stopLoading();
            showMainFrameError(
                    "Matagal ang koneksiyon at hindi ma-load ang registration system. "
                            + "Suriin ang internet connection, pagkatapos ay pindutin ang Retry."
            );
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        createContentView();
        startWebApp();
    }

    private void startWebApp() {
        if (!initializeWebView()) {
            showStartupError();
            return;
        }

        try {
            loadInitialUrl();
        } catch (RuntimeException | LinkageError exception) {
            Log.e(LOG_TAG, "Unable to load the registration URL.", exception);
            showMainFrameError(
                    "Hindi masimulan ang registration system. Pindutin ang Retry upang subukan ulit."
            );
        }
    }

    private void showStartupError() {
        pageLoading = false;
        cancelPageLoadTimeout();

        LinearLayout container = createCenteredContainer();
        container.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView title = new TextView(this);
        title.setText(R.string.webview_startup_error_title);
        title.setTextColor(Color.rgb(31, 41, 55));
        title.setTextSize(20f);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = wrapContentLayoutParams();
        titleParams.bottomMargin = dp(12);
        container.addView(title, titleParams);

        TextView message = new TextView(this);
        message.setText(R.string.webview_startup_error_message);
        message.setTextColor(Color.rgb(75, 85, 99));
        message.setTextSize(15f);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = wrapContentLayoutParams();
        messageParams.bottomMargin = dp(22);
        container.addView(message, messageParams);

        Button retryButton = new Button(this);
        retryButton.setText(R.string.webview_retry);
        retryButton.setAllCaps(false);
        retryButton.setOnClickListener(view -> retryStartup());
        container.addView(retryButton, new LinearLayout.LayoutParams(dp(180), dp(52)));

        setContentView(container);
    }

    private void retryStartup() {
        if (rootView == null) {
            recreate();
            return;
        }

        setContentView(rootView);
        loadingView.setVisibility(View.VISIBLE);
        errorView.setVisibility(View.GONE);
        startWebApp();
    }

    private void configureSystemBars() {
        getWindow().setStatusBarColor(Color.rgb(13, 110, 253));
        getWindow().setNavigationBarColor(Color.BLACK);
    }

    private void createContentView() {
        rootView = new FrameLayout(this);
        rootView.setBackgroundColor(Color.rgb(13, 110, 253));

        loadingView = createLoadingView();
        rootView.addView(loadingView, matchParentLayoutParams());

        errorView = createErrorView();
        errorView.setVisibility(View.GONE);
        rootView.addView(errorView, matchParentLayoutParams());

        setContentView(rootView);
    }

    private FrameLayout.LayoutParams matchParentLayoutParams() {
        return new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
    }

    private View createLoadingView() {
        LinearLayout container = createCenteredContainer();

        ProgressBar progressBar = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(48), dp(48));
        progressParams.bottomMargin = dp(18);
        container.addView(progressBar, progressParams);

        TextView message = new TextView(this);
        message.setText(R.string.webview_loading);
        message.setTextColor(Color.rgb(55, 65, 81));
        message.setTextSize(16f);
        message.setGravity(Gravity.CENTER);
        container.addView(message, wrapContentLayoutParams());

        return container;
    }

    private View createErrorView() {
        LinearLayout container = createCenteredContainer();
        container.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView title = new TextView(this);
        title.setText(R.string.webview_error_title);
        title.setTextColor(Color.rgb(31, 41, 55));
        title.setTextSize(20f);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = wrapContentLayoutParams();
        titleParams.bottomMargin = dp(12);
        container.addView(title, titleParams);

        errorMessageView = new TextView(this);
        errorMessageView.setTextColor(Color.rgb(75, 85, 99));
        errorMessageView.setTextSize(15f);
        errorMessageView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = wrapContentLayoutParams();
        messageParams.bottomMargin = dp(22);
        container.addView(errorMessageView, messageParams);

        Button retryButton = new Button(this);
        retryButton.setText(R.string.webview_retry);
        retryButton.setAllCaps(false);
        retryButton.setOnClickListener(view -> retryLastPage());
        container.addView(retryButton, new LinearLayout.LayoutParams(dp(180), dp(52)));

        return container;
    }

    private LinearLayout createCenteredContainer() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setBackgroundColor(Color.rgb(246, 248, 251));
        return container;
    }

    private LinearLayout.LayoutParams wrapContentLayoutParams() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private boolean initializeWebView() {
        WebView candidate;
        try {
            candidate = new WebView(this);
        } catch (RuntimeException | LinkageError exception) {
            Log.e(LOG_TAG, "The phone has no usable System WebView provider.", exception);
            webView = null;
            return false;
        }

        webView = candidate;
        webView.setBackgroundColor(Color.rgb(246, 248, 251));
        rootView.addView(webView, 0, matchParentLayoutParams());
        configureWebViewBestEffort();
        return true;
    }

    private void configureWebViewBestEffort() {
        applyWebViewSetting(
                "disable WebView debugging",
                () -> WebView.setWebContentsDebuggingEnabled(false)
        );

        WebSettings settings;
        try {
            settings = webView.getSettings();
        } catch (RuntimeException | LinkageError exception) {
            Log.w(LOG_TAG, "Unable to read WebView settings; using provider defaults.", exception);
            settings = null;
        }

        if (settings != null) {
            WebSettings finalSettings = settings;
            applyWebViewSetting("enable JavaScript", () -> finalSettings.setJavaScriptEnabled(true));
            applyWebViewSetting("enable DOM storage", () -> finalSettings.setDomStorageEnabled(true));
            applyWebViewSetting("enable database storage", () -> finalSettings.setDatabaseEnabled(true));
            applyWebViewSetting(
                    "use the default cache mode",
                    () -> finalSettings.setCacheMode(WebSettings.LOAD_DEFAULT)
            );
            applyWebViewSetting("disable file access", () -> finalSettings.setAllowFileAccess(false));
            applyWebViewSetting(
                    "disable content-provider access",
                    () -> finalSettings.setAllowContentAccess(false)
            );
            applyWebViewSetting(
                    "disable multiple windows",
                    () -> finalSettings.setSupportMultipleWindows(false)
            );
            applyWebViewSetting(
                    "disable automatic JavaScript windows",
                    () -> finalSettings.setJavaScriptCanOpenWindowsAutomatically(false)
            );
            applyWebViewSetting(
                    "require a media playback gesture",
                    () -> finalSettings.setMediaPlaybackRequiresUserGesture(true)
            );
            applyWebViewSetting(
                    "disable built-in zoom controls",
                    () -> finalSettings.setBuiltInZoomControls(false)
            );
            applyWebViewSetting(
                    "hide zoom controls",
                    () -> finalSettings.setDisplayZoomControls(false)
            );
            applyWebViewSetting(
                    "set the app user agent",
                    () -> finalSettings.setUserAgentString(
                            finalSettings.getUserAgentString() + " CabarianRegistrationApp/5"
                    )
            );
            applyWebViewSetting(
                    "block mixed content",
                    () -> finalSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)
            );
        }

        applyWebViewSetting("configure cookies", () -> {
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, false);
        });
        applyWebViewSetting(
                "install the navigation client",
                () -> webView.setWebViewClient(new RegistrationWebViewClient())
        );
        applyWebViewSetting(
                "install the file chooser client",
                () -> webView.setWebChromeClient(new RegistrationWebChromeClient())
        );
    }

    private void applyWebViewSetting(String operation, Runnable setting) {
        try {
            setting.run();
        } catch (RuntimeException | LinkageError exception) {
            Log.w(LOG_TAG, "Unable to " + operation + ".", exception);
        }
    }

    private void loadInitialUrl() {
        Uri deepLink = getIntent() == null ? null : getIntent().getData();
        String initialUrl = isTrustedAppUri(deepLink) ? deepLink.toString() : START_URL;
        loadTrustedUrl(initialUrl);
    }

    private void loadTrustedUrl(String url) {
        Uri uri = Uri.parse(url);
        if (!isTrustedAppUri(uri)) {
            uri = Uri.parse(START_URL);
        }

        lastRequestedUrl = uri.toString();
        mainFrameFailed = false;
        errorView.setVisibility(View.GONE);
        loadingView.setVisibility(View.VISIBLE);
        webView.loadUrl(lastRequestedUrl);
    }

    private void retryLastPage() {
        loadTrustedUrl(lastRequestedUrl);
    }

    private boolean isTrustedAppUri(Uri uri) {
        if (uri == null
                || !"https".equalsIgnoreCase(uri.getScheme())
                || !APP_HOST.equalsIgnoreCase(uri.getHost())) {
            return false;
        }

        int port = uri.getPort();
        String path = uri.getPath();
        return (port == -1 || port == 443)
                && path != null
                && path.startsWith(APP_PATH_PREFIX);
    }

    private boolean handleNavigation(Uri uri) {
        if (isTrustedAppUri(uri)) {
            return false;
        }

        if (uri == null) {
            return true;
        }

        String scheme = uri.getScheme();
        if ("https".equalsIgnoreCase(scheme)
                || "http".equalsIgnoreCase(scheme)
                || "mailto".equalsIgnoreCase(scheme)
                || "tel".equalsIgnoreCase(scheme)) {
            openExternalUri(uri);
        }

        return true;
    }

    private void openExternalUri(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(this, "No app is available to open this link.", Toast.LENGTH_SHORT)
                    .show();
        }
    }

    private void schedulePageLoadTimeout() {
        mainHandler.removeCallbacks(pageLoadTimeout);
        mainHandler.postDelayed(pageLoadTimeout, PAGE_LOAD_TIMEOUT_MS);
    }

    private void cancelPageLoadTimeout() {
        mainHandler.removeCallbacks(pageLoadTimeout);
    }

    private void showMainFrameError(String message) {
        mainFrameFailed = true;
        pageLoading = false;
        cancelPageLoadTimeout();
        loadingView.setVisibility(View.GONE);
        errorMessageView.setText(message);
        errorView.setVisibility(View.VISIBLE);
    }

    private final class RegistrationWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request == null ? null : request.getUrl());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(url == null ? null : Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            if (isTrustedAppUri(Uri.parse(url))) {
                lastRequestedUrl = url;
            }
            mainFrameFailed = false;
            pageLoading = true;
            errorView.setVisibility(View.GONE);
            loadingView.setVisibility(View.VISIBLE);
            schedulePageLoadTimeout();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            pageLoading = false;
            cancelPageLoadTimeout();
            if (!mainFrameFailed) {
                loadingView.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
            }
        }

        @Override
        public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
        ) {
            super.onReceivedError(view, request, error);
            if (request != null && request.isForMainFrame()) {
                showMainFrameError(
                        "Hindi ma-load ang registration system. Suriin ang internet connection, "
                                + "pagkatapos ay pindutin ang Retry."
                );
            }
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(
                WebView view,
                int errorCode,
                String description,
                String failingUrl
        ) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    && failingUrl != null
                    && failingUrl.equals(view.getUrl())) {
                showMainFrameError(
                        "Hindi ma-load ang registration system. Suriin ang internet connection, "
                                + "pagkatapos ay pindutin ang Retry."
                );
            }
        }

        @Override
        public void onReceivedSslError(
                WebView view,
                SslErrorHandler handler,
                SslError error
        ) {
            handler.cancel();
            showMainFrameError(
                    "Hindi ligtas ang koneksiyon sa registration server. "
                            + "Pakisuri ang petsa, oras, at internet connection ng phone."
            );
        }

    }

    private boolean isImageCaptureRequest(WebChromeClient.FileChooserParams params) {
        if (params == null
                || params.getMode() != WebChromeClient.FileChooserParams.MODE_OPEN) {
            return false;
        }

        boolean sawImageType = false;
        String[] acceptGroups = params.getAcceptTypes();
        if (acceptGroups == null) {
            return false;
        }

        for (String acceptGroup : acceptGroups) {
            if (acceptGroup == null) {
                continue;
            }
            for (String rawType : acceptGroup.split(",")) {
                String type = rawType.trim().toLowerCase(Locale.ROOT);
                if (type.isEmpty()) {
                    continue;
                }
                if (!type.startsWith("image/")) {
                    return false;
                }
                sawImageType = true;
            }
        }
        return sawImageType;
    }

    private void completeFileChooser(Uri[] result) {
        ValueCallback<Uri[]> callback = fileChooserCallback;
        fileChooserCallback = null;
        if (callback != null) {
            callback.onReceiveValue(result);
        }
    }

    private void clearPendingCameraCapture(boolean deleteOutput) {
        Uri captureUri = pendingCameraUri;
        File captureFile = pendingCameraFile;
        pendingCameraUri = null;
        pendingCameraFile = null;

        if (captureUri != null) {
            try {
                revokeUriPermission(
                        captureUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                );
            } catch (RuntimeException exception) {
                Log.w(LOG_TAG, "Unable to revoke the temporary camera URI grant.", exception);
            }
        }

        if (deleteOutput && captureFile != null) {
            cameraTempFiles.remove(captureFile);
            if (captureFile.exists() && !captureFile.delete()) {
                Log.w(LOG_TAG, "Unable to delete a cancelled camera image.");
            }
        }
    }

    private void scheduleCameraCacheCleanup() {
        mainHandler.removeCallbacks(cameraCacheCleanup);
        if (!cameraTempFiles.isEmpty()) {
            mainHandler.postDelayed(cameraCacheCleanup, CAMERA_CACHE_CLEANUP_DELAY_MS);
        }
    }

    private void deleteCompletedCameraFiles() {
        for (int index = cameraTempFiles.size() - 1; index >= 0; index--) {
            File cameraFile = cameraTempFiles.get(index);
            if (cameraFile.equals(pendingCameraFile)) {
                continue;
            }
            if (cameraFile.exists() && !cameraFile.delete()) {
                Log.w(LOG_TAG, "Unable to delete a processed camera image.");
            }
            cameraTempFiles.remove(index);
        }
        scheduleCameraCacheCleanup();
    }

    private boolean launchCameraCapture() {
        try {
            File cameraDirectory = new File(getCacheDir(), "camera");
            if (!cameraDirectory.isDirectory() && !cameraDirectory.mkdirs()) {
                throw new IOException("Unable to create the camera cache directory.");
            }

            pendingCameraFile = File.createTempFile("capture-", ".jpg", cameraDirectory);
            cameraTempFiles.add(pendingCameraFile);
            pendingCameraUri = FileProvider.getUriForFile(
                    this,
                    getString(R.string.providerAuthority),
                    pendingCameraFile
            );

            Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
            cameraIntent.setClipData(ClipData.newRawUri("camera-output", pendingCameraUri));
            cameraIntent.addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
            startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST_CODE);
        } catch (IOException | RuntimeException exception) {
            Log.e(LOG_TAG, "Unable to launch the phone camera.", exception);
            clearPendingCameraCapture(true);
            completeFileChooser(null);
            Toast.makeText(
                    this,
                    "Hindi mabuksan ang camera sa phone na ito.",
                    Toast.LENGTH_SHORT
            ).show();
        }
        return true;
    }

    private final class RegistrationWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams fileChooserParams
        ) {
            completeFileChooser(null);
            clearPendingCameraCapture(true);
            fileChooserCallback = callback;

            if (isImageCaptureRequest(fileChooserParams)) {
                return launchCameraCapture();
            }

            Intent chooserIntent;
            try {
                chooserIntent = fileChooserParams.createIntent();
                startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                return true;
            } catch (RuntimeException exception) {
                completeFileChooser(null);
                Toast.makeText(
                        LauncherActivity.this,
                        "No file picker is available on this phone.",
                        Toast.LENGTH_SHORT
                ).show();
                return true;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST_CODE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }

        Uri[] result;
        if (pendingCameraUri != null) {
            boolean captured = resultCode == RESULT_OK
                    && pendingCameraFile != null
                    && pendingCameraFile.length() > 0;
            result = captured ? new Uri[]{pendingCameraUri} : null;
            clearPendingCameraCapture(!captured);
            if (captured) {
                scheduleCameraCacheCleanup();
            }
        } else {
            result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        }
        completeFileChooser(result);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            if (errorView != null && errorView.getVisibility() == View.VISIBLE) {
                errorView.setVisibility(View.GONE);
            }
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            try {
                webView.onResume();
            } catch (RuntimeException | LinkageError exception) {
                Log.w(LOG_TAG, "Unable to resume the in-app WebView.", exception);
            }
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            try {
                webView.onPause();
                CookieManager.getInstance().flush();
            } catch (RuntimeException | LinkageError exception) {
                Log.w(LOG_TAG, "Unable to pause the WebView or flush cookies.", exception);
            }
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        cancelPageLoadTimeout();
        mainHandler.removeCallbacks(cameraCacheCleanup);
        completeFileChooser(null);
        clearPendingCameraCapture(true);
        deleteCompletedCameraFiles();

        releaseWebView();

        super.onDestroy();
    }

    private void releaseWebView() {
        WebView view = webView;
        webView = null;
        if (view == null) {
            return;
        }

        try {
            view.stopLoading();
            view.setWebChromeClient(null);
            view.setWebViewClient(null);
            if (rootView != null) {
                rootView.removeView(view);
            }
            view.destroy();
        } catch (RuntimeException | LinkageError exception) {
            Log.w(LOG_TAG, "Unable to release the in-app WebView cleanly.", exception);
        }
    }
}
