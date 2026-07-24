package app.letsq.queue;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridges the single Google Play subscription to the web-based Lets Q UI. */
@CapacitorPlugin(name = "LetsQBilling")
public class LetsQBillingPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void getSubscriptionStatus(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).refreshSubscriptionEntitlement(call);
        } else {
            call.resolve();
        }
    }

    @com.getcapacitor.PluginMethod
    public void purchaseAdFree(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).purchaseAdFree(call);
        } else {
            call.reject("Google Play Billing is unavailable on this device.");
        }
    }
}
