# notifications

This service listens for updates in the `patches` table, and then sends notifications to subscriptions.

### Why

I split this into its own service as sending a notification takes around 800ms from my tests.

If the subscriptions table reaches enough size sending these notifications will take enough time to timeout the
serverless function (10s).

I didn't want to use an external notifications service due to unknown costs. This should scale to thousands of
subscriptions for the same money as 0.
