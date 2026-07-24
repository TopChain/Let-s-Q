package app.letsq.queue;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the rating-complete screen request a native interstitial ad. */
@CapacitorPlugin(name = "LetsQAds")
public class LetsQAdsPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void showRatingInterstitial(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).showRatingInterstitial(call::resolve);
        } else {
            call.resolve();
        }
    }

    @com.getcapacitor.PluginMethod
    public void showReportReward(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).showReportReward(call);
        } else {
            call.reject("Native ads are available only in the installed app.");
        }
    }
}
