package app.letsq.queue;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdView;

import java.lang.reflect.Field;

/**
 * Native ad bridge plus first-party Let’s Q fallback promotions.
 *
 * Real AdMob inventory always wins. When an ad has not loaded yet, is awaiting
 * approval, or returns no-fill, the placement is filled with Let’s Q product
 * education instead of a blank/error state.
 */
@CapacitorPlugin(name = "LetsQAds")
public class LetsQAdsPlugin extends Plugin {
    private static final long BANNER_WATCH_INTERVAL_MS = 1000L;
    private static final long APP_OPEN_FALLBACK_DELAY_MS = 6500L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LetsQHouseAds houseAds;
    private boolean houseBannerVisible = false;
    private int appOpenFallbackChecks = 0;

    @Override
    public void load() {
        if (getActivity() == null || getBridge() == null || getBridge().getWebView() == null) return;
        ViewGroup parent = (ViewGroup) getBridge().getWebView().getParent();
        houseAds = new LetsQHouseAds(getActivity(), parent);
        handler.post(this::watchBannerPlacement);
        handler.postDelayed(this::maybeShowAppOpenFallback, APP_OPEN_FALLBACK_DELAY_MS);
    }

    /** Called by the rating-complete screen after the anonymous rating is saved. */
    @com.getcapacitor.PluginMethod
    public void showRatingInterstitial(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) {
            showHouseFullPage(
                "LET’S Q TIP",
                "Waiting should not mean standing in line.",
                "Join by QR or short code, wait anywhere, and check live status without creating a Queuer account.",
                call::resolve
            );
            return;
        }

        long startedAt = android.os.SystemClock.elapsedRealtime();
        ((MainActivity) getActivity()).showRatingInterstitial(() -> {
            long elapsed = android.os.SystemClock.elapsedRealtime() - startedAt;
            // A real full-screen ad keeps this callback pending until dismissal.
            // An immediate callback means there was no loaded interstitial (or it
            // failed to show), so fill the same placement with our house promo.
            if (!isAdFree() && elapsed < 700L) {
                showHouseFullPage(
                    "THANK YOU",
                    "You help every line move better.",
                    "Let’s Q keeps queueing simple: private joining, live status, and no name, phone number, or email required for Queuers.",
                    call::resolve
                );
            } else {
                call.resolve();
            }
        });
    }

    @com.getcapacitor.PluginMethod
    public void showReportReward(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Native report rewards are available only in the installed app.");
            return;
        }

        MainActivity activity = (MainActivity) getActivity();
        if (isAdFree() || readActivityField("reportRewardedAd") != null) {
            activity.showReportReward(call);
            return;
        }

        // Until rewarded inventory is actually available, a completed first-party
        // product message stands in for the sponsor message and unlocks this one
        // report session. Once AdMob loads a rewarded ad, the real ad is used.
        showHouseFullPage(
            "HOST TIP",
            "Turn queue activity into useful insight.",
            "Let’s Q reports summarize volume, wait times, no-shows, and anonymous ratings so Hosts can improve the next event.",
            () -> {
                JSObject result = new JSObject();
                result.put("earned", true);
                result.put("source", "letsq-house-promo");
                call.resolve(result);
            }
        );
    }

    private void watchBannerPlacement() {
        if (getActivity() == null || getActivity().isFinishing() || getActivity().isDestroyed()) {
            if (houseAds != null) houseAds.destroy();
            return;
        }

        boolean adFree = isAdFree();
        boolean realBannerLoaded = false;
        ViewGroup parent = (ViewGroup) getBridge().getWebView().getParent();

        for (int index = 0; index < parent.getChildCount(); index++) {
            View child = parent.getChildAt(index);
            if (!(child instanceof AdView)) continue;
            AdView adView = (AdView) child;
            boolean loaded = adView.getResponseInfo() != null;
            if (adFree || !loaded) {
                // Do not let an empty native AdView cover the house banner.
                adView.setVisibility(View.GONE);
            } else {
                realBannerLoaded = true;
                adView.setVisibility(View.VISIBLE);
                adView.bringToFront();
            }
        }

        if (adFree || realBannerLoaded) {
            if (houseBannerVisible && houseAds != null) {
                houseAds.hideBanner();
                houseBannerVisible = false;
            }
            if (adFree) setWebViewBottomInset(0);
        } else if (!houseBannerVisible && houseAds != null) {
            int height = houseAds.showBanner();
            houseBannerVisible = height > 0;
            if (height > 0) setWebViewBottomInset(height);
        }

        handler.postDelayed(this::watchBannerPlacement, BANNER_WATCH_INTERVAL_MS);
    }

    private void maybeShowAppOpenFallback() {
        if (!(getActivity() instanceof MainActivity) || isAdFree()) return;
        if (getActivity().isFinishing() || getActivity().isDestroyed()) return;

        boolean alreadyShown = readBooleanActivityField("appOpenShownForSession");
        boolean currentlyShowing = readBooleanActivityField("appOpenShowing");
        Object loadedAd = readActivityField("appOpenAd");
        boolean loading = readBooleanActivityField("appOpenLoading");

        if (alreadyShown || currentlyShowing) return;

        // Give a real App Open request time to win. If it remains actively
        // loading, wait a little longer before deciding the placement is empty.
        if ((loadedAd != null || loading) && appOpenFallbackChecks < 3) {
            appOpenFallbackChecks++;
            handler.postDelayed(this::maybeShowAppOpenFallback, 2500L);
            return;
        }

        if (loadedAd != null) return;

        writeBooleanActivityField("appOpenShownForSession", true);
        showHouseFullPage(
            "WELCOME TO LET’S Q",
            "Waiting should not mean standing in line.",
            "Queuers can join privately with a QR or short code. Hosts can launch and manage a live queue from the same app.",
            null
        );
    }

    private void showHouseFullPage(String kicker, String title, String body, Runnable finished) {
        if (houseAds == null && getActivity() != null && getBridge() != null && getBridge().getWebView() != null) {
            houseAds = new LetsQHouseAds(
                getActivity(),
                (ViewGroup) getBridge().getWebView().getParent()
            );
        }
        if (houseAds == null || isAdFree()) {
            if (finished != null) finished.run();
            return;
        }
        houseAds.showFullPage(kicker, title, body, finished);
    }

    private boolean isAdFree() {
        if (getActivity() == null) return false;
        return getActivity()
            .getSharedPreferences("letsq", android.content.Context.MODE_PRIVATE)
            .getBoolean("ad_free_active", false);
    }

    private void setWebViewBottomInset(int insetPx) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        View webView = getBridge().getWebView();
        ViewGroup.LayoutParams params = webView.getLayoutParams();
        if (!(params instanceof ViewGroup.MarginLayoutParams)) return;
        ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) params;
        if (margins.bottomMargin == insetPx) return;
        margins.bottomMargin = insetPx;
        webView.setLayoutParams(margins);
    }

    private Object readActivityField(String name) {
        if (!(getActivity() instanceof MainActivity)) return null;
        try {
            Field field = MainActivity.class.getDeclaredField(name);
            field.setAccessible(true);
            return field.get(getActivity());
        } catch (ReflectiveOperationException ignored) {
            return null;
        }
    }

    private boolean readBooleanActivityField(String name) {
        Object value = readActivityField(name);
        return value instanceof Boolean && (Boolean) value;
    }

    private void writeBooleanActivityField(String name, boolean value) {
        if (!(getActivity() instanceof MainActivity)) return;
        try {
            Field field = MainActivity.class.getDeclaredField(name);
            field.setAccessible(true);
            field.setBoolean(getActivity(), value);
        } catch (ReflectiveOperationException ignored) {
            // Fallback UI is non-critical; never crash the queue flow for it.
        }
    }
}
