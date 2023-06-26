// courtesy of https://github.com/GoogleChrome/workbox/issues/2593#issuecomment-674455562
import { NetworkFirst, StrategyHandler, type NetworkFirstOptions } from 'workbox-strategies';
import { registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

clientsClaim();

class DedupeNetworkFirst extends NetworkFirst {
    private _inflightRequests: Map<string, Promise<Response>>;

    constructor(options?: NetworkFirstOptions) {
        super(options);
        this._inflightRequests = new Map();
    }

    async _handle(request: Request, handler: StrategyHandler) {
        let inflightResponsePromise = this._inflightRequests.get(request.url);

        if (inflightResponsePromise) {
            const inflightResponse = await inflightResponsePromise;

            return inflightResponse.clone();
        } else {
            inflightResponsePromise = super._handle(request, handler);
            this._inflightRequests.set(request.url, inflightResponsePromise);

            try {
                const response = await inflightResponsePromise;
                return response.clone();
            } finally {
                this._inflightRequests.delete(request.url);
            }
        }
    }
}

registerRoute(
    /^https:\/\/(?:basemaps-api|static|cdn)\.arcgis\.com\//i,
    new DedupeNetworkFirst(),
);