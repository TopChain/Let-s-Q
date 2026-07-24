package app.letsq.queue;

import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.View;

import androidx.coordinatorlayout.widget.CoordinatorLayout;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.appopen.AppOpenAd.AppOpenAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.Collections;
import java.util.List;

public class MainActivity extends BridgeActivity implements PurchasesUpdatedListener {
    // Your real banner unit. Debug builds deliberately use Google's test unit.
    private static final String LIVE_BANNER_AD_UNIT_ID = "ca-app-pub-5866109338835517/4230573369";
    private static final String TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741";
    // This is shown only after a queuer voluntarily submits an experience rating.
    private static final String LIVE_RATING_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5866109338835517/3499945620";
    private static final String TEST_RATING_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712";
    // App Open appears only once per app session. The ad itself controls when
    // it can be closed; Let’s Q never adds a forced countdown over it.
    private static final String LIVE_APP_OPEN_AD_UNIT_ID = "ca-app-pub-5866109338835517/9877074724";
    private static final String TEST_APP_OPEN_AD_UNIT_ID = "ca-app-pub-3940256099942544/9257395921";
    // Hosts earn a one-session Q Report unlock after AdMob confirms reward.
    private static final String LIVE_REPORT_REWARDED_AD_UNIT_ID = "ca-app-pub-5866109338835517/8169507310";
    private static final String TEST_REPORT_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
    // This must exactly match the immutable product ID created in Play Console.
    private static final String AD_FREE_PRODUCT_ID = "letsq_ad_free_monthly";

    private AdView bannerAd;
    private InterstitialAd ratingInterstitialAd;
    private AppOpenAd appOpenAd;
    private RewardedAd reportRewardedAd;
    private boolean mobileAdsStarted = false;
    private boolean interstitialLoading = false;
    private boolean appOpenLoading = false;
    private boolean appOpenShowing = false;
    private boolean appOpenShownForSession = false;
    private boolean reportRewardLoading = false;
    private int bannerInsetPx = 0;
    private BillingClient billingClient;
    private boolean adFreeActive = false;
    private com.getcapacitor.PluginCall pendingPurchaseCall;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdMobPrivacyPlugin.class);
        registerPlugin(LetsQAdsPlugin.class);
        registerPlugin(LetsQBillingPlugin.class);
        super.onCreate(savedInstanceState);
        adFreeActive = getSharedPreferences("letsq", MODE_PRIVATE).getBoolean("ad_free_active", false);
        startBilling();
        requestConsentThenStartAds();
    }

    private void startBilling() {
        billingClient = BillingClient.newBuilder(this)
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build();
        connectBilling();
    }

    private void connectBilling() {
        if (billingClient == null || billingClient.isReady()) {
            refreshSubscriptionEntitlement(null);
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    refreshSubscriptionEntitlement(null);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // A later action will reconnect. Do not mark an existing purchase inactive.
            }
        });
    }

    private void requestConsentThenStartAds() {
        ConsentInformation consentInformation = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters parameters = new ConsentRequestParameters.Builder().build();

        consentInformation.requestConsentInfoUpdate(
            this,
            parameters,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                this,
                formError -> {
                    if (consentInformation.canRequestAds()) {
                        startAds();
                    }
                }
            ),
            formError -> {
                // If a network check fails but consent from a prior session is valid,
                // the SDK still allows ads to start.
                if (consentInformation.canRequestAds()) {
                    startAds();
                }
            }
        );
    }

    private void startAds() {
        if (mobileAdsStarted) return;
        mobileAdsStarted = true;
        MobileAds.initialize(this, initializationStatus -> {
            loadBottomBanner();
            loadRatingInterstitial();
            loadReportRewarded();
            loadAppOpenAd();
        });
    }

    private void loadBottomBanner() {
        runOnUiThread(() -> {
            bannerAd = new AdView(this);
            bannerAd.setAdUnitId(isDebugBuild() ? TEST_BANNER_AD_UNIT_ID : LIVE_BANNER_AD_UNIT_ID);
            bannerAd.setAdSize(AdSize.getLargeAnchoredAdaptiveBannerAdSize(this, getBannerWidthDp()));
            bannerAd.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    // Resize the WebView instead of covering it. Its fixed five-tab
                    // navigation then sits immediately above this native banner.
                    setWebViewBannerInset(bannerAd.getAdSize().getHeightInPixels(MainActivity.this));
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    setWebViewBannerInset(0);
                }
            });

            // Capacitor's WebView fills the screen. Add the banner as a sibling
            // above that WebView rather than to the activity decor, otherwise the
            // WebView can draw over the loaded banner.
            ViewGroup webViewParent = (ViewGroup) getBridge().getWebView().getParent();
            CoordinatorLayout.LayoutParams layoutParams = new CoordinatorLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            layoutParams.gravity = Gravity.BOTTOM;
            webViewParent.addView(bannerAd, layoutParams);
            bannerAd.bringToFront();
            bannerAd.setVisibility(adFreeActive ? View.GONE : View.VISIBLE);
            if (adFreeActive) setWebViewBannerInset(0);
            bannerAd.loadAd(new AdRequest.Builder().build());
        });
    }

    private void setWebViewBannerInset(int insetPx) {
        runOnUiThread(() -> {
            View webView = getBridge().getWebView();
            ViewGroup.LayoutParams params = webView.getLayoutParams();
            if (!(params instanceof ViewGroup.MarginLayoutParams)) return;
            ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) params;
            if (bannerInsetPx == insetPx && margins.bottomMargin == insetPx) return;
            bannerInsetPx = insetPx;
            margins.bottomMargin = insetPx;
            webView.setLayoutParams(margins);
        });
    }

    private int getBannerWidthDp() {
        float density = getResources().getDisplayMetrics().density;
        int widthPixels = getResources().getDisplayMetrics().widthPixels;
        return Math.round(widthPixels / density);
    }

    private void loadRatingInterstitial() {
        if (interstitialLoading || ratingInterstitialAd != null) return;
        interstitialLoading = true;
        InterstitialAd.load(
            this,
            isDebugBuild() ? TEST_RATING_INTERSTITIAL_AD_UNIT_ID : LIVE_RATING_INTERSTITIAL_AD_UNIT_ID,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(InterstitialAd interstitialAd) {
                    ratingInterstitialAd = interstitialAd;
                    interstitialLoading = false;
                }

                @Override
                public void onAdFailedToLoad(LoadAdError loadAdError) {
                    ratingInterstitialAd = null;
                    interstitialLoading = false;
                }
            }
        );
    }

    /** Called by the web page only after the anonymous rating was saved. */
    public void showRatingInterstitial(Runnable finished) {
        runOnUiThread(() -> {
            if (ratingInterstitialAd == null) {
                // Never interrupt the rating confirmation while an ad is loading.
                loadRatingInterstitial();
                finished.run();
                return;
            }

            InterstitialAd ad = ratingInterstitialAd;
            ratingInterstitialAd = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    loadRatingInterstitial();
                    finished.run();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError adError) {
                    loadRatingInterstitial();
                    finished.run();
                }
            });
            ad.show(this);
        });
    }

    private void loadAppOpenAd() {
        if (appOpenLoading || appOpenAd != null || appOpenShownForSession) return;
        appOpenLoading = true;
        AppOpenAd.load(
            this,
            isDebugBuild() ? TEST_APP_OPEN_AD_UNIT_ID : LIVE_APP_OPEN_AD_UNIT_ID,
            new AdRequest.Builder().build(),
            new AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(AppOpenAd ad) {
                    appOpenAd = ad;
                    appOpenLoading = false;
                    showAppOpenAdIfAvailable();
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    appOpenAd = null;
                    appOpenLoading = false;
                }
            }
        );
    }

    private void showAppOpenAdIfAvailable() {
        if (appOpenShownForSession || appOpenShowing || appOpenAd == null || isFinishing() || isDestroyed()) return;
        AppOpenAd ad = appOpenAd;
        appOpenAd = null;
        appOpenShowing = true;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                appOpenShowing = false;
                appOpenShownForSession = true;
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                appOpenShowing = false;
                appOpenShownForSession = true;
            }
        });
        ad.show(this);
    }

    private void loadReportRewarded() {
        if (reportRewardLoading || reportRewardedAd != null) return;
        reportRewardLoading = true;
        RewardedAd.load(
            this,
            isDebugBuild() ? TEST_REPORT_REWARDED_AD_UNIT_ID : LIVE_REPORT_REWARDED_AD_UNIT_ID,
            new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(RewardedAd ad) {
                    reportRewardedAd = ad;
                    reportRewardLoading = false;
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    reportRewardedAd = null;
                    reportRewardLoading = false;
                }
            }
        );
    }

    /** Shows the report reward and resolves only after AdMob awards it. */
    public void showReportReward(com.getcapacitor.PluginCall call) {
        runOnUiThread(() -> {
            if (adFreeActive) {
                com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
                result.put("earned", true);
                call.resolve(result);
                return;
            }
            if (reportRewardedAd == null) {
                loadReportRewarded();
                call.reject("The report reward is loading. Please try again in a moment.");
                return;
            }

            RewardedAd ad = reportRewardedAd;
            reportRewardedAd = null;
            final boolean[] earned = { false };
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    if (!earned[0]) call.reject("Finish the sponsored message to unlock this report.");
                    loadReportRewarded();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    call.reject("The report reward could not be shown. Please try again.");
                    loadReportRewarded();
                }
            });
            ad.show(this, rewardItem -> {
                earned[0] = true;
                com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
                result.put("earned", true);
                call.resolve(result);
            });
        });
    }

    private boolean isDebugBuild() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    @Override
    public void onResume() {
        super.onResume();
        showAppOpenAdIfAvailable();
    }

    /** Refreshes the locally held entitlement from Google Play's owned purchases. */
    public void refreshSubscriptionEntitlement(com.getcapacitor.PluginCall call) {
        if (billingClient == null || !billingClient.isReady()) {
            connectBilling();
            if (call != null) resolveSubscriptionStatus(call, adFreeActive);
            return;
        }
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        billingClient.queryPurchasesAsync(params, (result, purchases) -> {
            boolean active = result.getResponseCode() == BillingClient.BillingResponseCode.OK && ownsAdFree(purchases);
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                setAdFreeActive(active);
            }
            if (call != null) resolveSubscriptionStatus(call, adFreeActive);
        });
    }

    public void purchaseAdFree(com.getcapacitor.PluginCall call) {
        if (billingClient == null || !billingClient.isReady()) {
            call.reject("Google Play billing is still connecting. Please try again in a moment.");
            connectBilling();
            return;
        }
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(AD_FREE_PRODUCT_ID)
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();
        billingClient.queryProductDetailsAsync(params, (result, queryResult) -> {
            List<ProductDetails> productDetailsList = queryResult.getProductDetailsList();
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
                call.reject("The subscription is not available yet. Please try again after it is activated in Google Play.");
                return;
            }
            ProductDetails details = productDetailsList.get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) {
                call.reject("No eligible subscription offer is available for this Google Play account.");
                return;
            }
            BillingFlowParams.ProductDetailsParams productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
                .setOfferToken(offers.get(0).getOfferToken())
                .build();
            pendingPurchaseCall = call;
            BillingResult launchResult = billingClient.launchBillingFlow(
                this,
                BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(productParams))
                    .build()
            );
            if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                pendingPurchaseCall = null;
                call.reject("Google Play could not open the purchase screen. Please try again.");
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean active = ownsAdFree(purchases);
            if (active) {
                for (Purchase purchase : purchases) acknowledgeIfNeeded(purchase);
                setAdFreeActive(true);
            }
            if (pendingPurchaseCall != null) {
                resolveSubscriptionStatus(pendingPurchaseCall, adFreeActive);
                pendingPurchaseCall = null;
            }
        } else if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED && pendingPurchaseCall != null) {
            pendingPurchaseCall.reject("Google Play could not complete the purchase. Please try again.");
            pendingPurchaseCall = null;
        } else if (pendingPurchaseCall != null) {
            pendingPurchaseCall.resolve();
            pendingPurchaseCall = null;
        }
    }

    private boolean ownsAdFree(List<Purchase> purchases) {
        for (Purchase purchase : purchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED && purchase.getProducts().contains(AD_FREE_PRODUCT_ID)) {
                acknowledgeIfNeeded(purchase);
                return true;
            }
        }
        return false;
    }

    private void acknowledgeIfNeeded(Purchase purchase) {
        if (!purchase.isAcknowledged()) {
            billingClient.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
                result -> { }
            );
        }
    }

    private void setAdFreeActive(boolean active) {
        adFreeActive = active;
        getSharedPreferences("letsq", MODE_PRIVATE).edit().putBoolean("ad_free_active", active).apply();
        runOnUiThread(() -> {
            if (bannerAd != null) {
                bannerAd.setVisibility(active ? View.GONE : View.VISIBLE);
                setWebViewBannerInset(active ? 0 : bannerAd.getAdSize().getHeightInPixels(this));
            }
        });
    }

    private void resolveSubscriptionStatus(com.getcapacitor.PluginCall call, boolean active) {
        com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
        result.put("active", active);
        call.resolve(result);
    }

    @Override
    public void onDestroy() {
        if (bannerAd != null) {
            bannerAd.destroy();
        }
        if (billingClient != null) billingClient.endConnection();
        super.onDestroy();
    }
}
