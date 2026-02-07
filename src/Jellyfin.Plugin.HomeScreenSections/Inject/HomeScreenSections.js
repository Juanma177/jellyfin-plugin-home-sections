'use strict';

if (typeof HomeScreenSectionsHandler == 'undefined') {
    const HomeScreenSectionsHandler = {
        // Touch state tracking to prevent mobile selection handler
        touchState: {
            startTime: 0,
            startX: 0,
            startY: 0,
            moved: false,
            target: null,
            longPressThreshold: 300, // ms - taps shorter than this open modal
            moveThreshold: 10 // px - movement greater than this cancels tap
        },
        init: function () {
            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
            var myObserver = new MutationObserver(this.mutationHandler);
            var observerConfig = { childList: true, characterData: true, attributes: true, subtree: true };

            $("body").each(function () {
                myObserver.observe(this, observerConfig);
            });
        },
        mutationHandler: function (mutationRecords) {
            mutationRecords.forEach(function (mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    [].some.call(mutation.addedNodes, function (addedNode) {
                        if ($(addedNode).hasClass('discover-card')) {
                            $(addedNode).on('click', '.discover-requestbutton', HomeScreenSectionsHandler.clickHandler);
                            $(addedNode).on('click', HomeScreenSectionsHandler.cardLinkHandler);

                            // Add touch event handlers to prevent mobile selection handler
                            HomeScreenSectionsHandler.attachTouchHandlers(addedNode);
                        }
                    });
                }
            });
        },
        // Attach touch event handlers to prevent Jellyfin's selection handler on mobile
        attachTouchHandlers: function (card) {
            var self = this;
            var el = card;

            // Prevent the default touch behavior that triggers selection
            el.addEventListener('touchstart', function (e) {
                // Don't interfere with request button
                if (e.target.closest('.discover-requestbutton')) {
                    return;
                }

                self.touchState.startTime = Date.now();
                self.touchState.startX = e.touches[0].clientX;
                self.touchState.startY = e.touches[0].clientY;
                self.touchState.moved = false;
                self.touchState.target = e.currentTarget;

                // Stop event from reaching Jellyfin's selection handler
                e.stopPropagation();
            }, { passive: true, capture: true });

            el.addEventListener('touchmove', function (e) {
                if (!self.touchState.target) return;

                var dx = Math.abs(e.touches[0].clientX - self.touchState.startX);
                var dy = Math.abs(e.touches[0].clientY - self.touchState.startY);

                if (dx > self.touchState.moveThreshold || dy > self.touchState.moveThreshold) {
                    self.touchState.moved = true;
                }
            }, { passive: true });

            el.addEventListener('touchend', function (e) {
                // Don't interfere with request button
                if (e.target.closest('.discover-requestbutton')) {
                    return;
                }

                var duration = Date.now() - self.touchState.startTime;
                var wasQuickTap = duration < self.touchState.longPressThreshold && !self.touchState.moved;

                // Stop propagation to prevent selection handler
                e.stopPropagation();
                e.preventDefault();

                // Only trigger modal on quick taps, not long presses
                if (wasQuickTap && self.touchState.target) {
                    var $card = $(self.touchState.target);
                    var tmdbId = parseInt($card.data('tmdb-id'));
                    var mediaType = $card.data('media-type');
                    var jellyseerrUrl = $card.data('jellyseerr-url');

                    self.openModal(tmdbId, mediaType, jellyseerrUrl);
                }

                // Reset touch state
                self.touchState.target = null;
                self.touchState.moved = false;
            }, { capture: true });

            // Also handle touchcancel
            el.addEventListener('touchcancel', function (e) {
                self.touchState.target = null;
                self.touchState.moved = false;
            }, { passive: true });
        },
        // Helper to open the modal (shared between touch and click handlers)
        openModal: function (tmdbId, mediaType, jellyseerrUrl) {
            // Try to open the more-info modal from Jellyfin Enhanced
            if (window.JellyfinEnhanced &&
                window.JellyfinEnhanced.jellyseerrMoreInfo &&
                window.JellyfinEnhanced.pluginConfig &&
                window.JellyfinEnhanced.pluginConfig.JellyseerrEnabled) {

                if (tmdbId && mediaType) {
                    window.JellyfinEnhanced.jellyseerrMoreInfo.open(tmdbId, mediaType);
                    return;
                }
            }

            // Fallback: open Jellyseerr URL in a new tab
            if (jellyseerrUrl) {
                window.open(jellyseerrUrl, '_blank', 'noopener,noreferrer');
            }
        },
        cardLinkHandler: function (event) {
            // Ignore clicks on the request button — those are handled by clickHandler
            if ($(event.target).closest('.discover-requestbutton').length > 0) {
                return;
            }

            // On touch devices, the touchend handler already handled this
            if ('ontouchstart' in window && event.type === 'click') {
                // Check if this looks like it came from a touch (no mouse movement)
                // We still want mouse clicks on desktop to work
                if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) {
                    event.preventDefault();
                    event.stopPropagation();
                    return; // Touch handler already dealt with this
                }
            }

            event.preventDefault();
            event.stopPropagation();

            var $card = $(this);
            var tmdbId = parseInt($card.data('tmdb-id'));
            var mediaType = $card.data('media-type');
            var jellyseerrUrl = $card.data('jellyseerr-url');

            HomeScreenSectionsHandler.openModal(tmdbId, mediaType, jellyseerrUrl);
        },
        clickHandler: function (event) {
            var mediaType = $(this).data('media-type');
            var mediaId = $(this).data('id');

            // Check if Jellyfin Enhanced plugin is available with Jellyseerr support
            if (window.JellyfinEnhanced &&
                window.JellyfinEnhanced.jellyseerrAPI &&
                window.JellyfinEnhanced.jellyseerrUI &&
                window.JellyfinEnhanced.pluginConfig &&
                window.JellyfinEnhanced.pluginConfig.JellyseerrEnabled) {

                var JE = window.JellyfinEnhanced;

                // Check user status first
                JE.jellyseerrAPI.checkUserStatus().then(function (status) {
                    if (!status.active || !status.userFound) {
                        Dashboard.alert("Jellyseerr integration not available or user not linked.");
                        return;
                    }

                    if (mediaType === 'tv') {
                        // Use Enhanced plugin's season selection modal for TV shows
                        JE.jellyseerrUI.showSeasonSelectionModal(mediaId, 'tv', 'this show');
                    } else {
                        // Use Enhanced plugin's movie request modal  
                        if (JE.pluginConfig.JellyseerrShowAdvanced) {
                            JE.jellyseerrUI.showMovieRequestModal(mediaId, 'this movie');
                        } else {
                            // Simple request without modal
                            JE.jellyseerrAPI.requestMedia(mediaId, 'movie').then(function () {
                                if (JE.toast) {
                                    JE.toast('Request submitted successfully!', 3000);
                                } else {
                                    Dashboard.alert("Item successfully requested");
                                }
                            }).catch(function (error) {
                                Dashboard.alert("Request failed: " + (error.message || "Unknown error"));
                            });
                        }
                    }
                }).catch(function (error) {
                    console.warn("Jellyfin Enhanced Jellyseerr check failed, falling back:", error);
                    // Fall back to original request method
                    HomeScreenSectionsHandler.fallbackRequest(mediaType, mediaId);
                });
            } else {
                // Fall back to original request if Enhanced plugin not available
                HomeScreenSectionsHandler.fallbackRequest(mediaType, mediaId);
            }
        },
        fallbackRequest: function (mediaType, mediaId) {
            window.ApiClient.ajax({
                url: window.ApiClient.getUrl("HomeScreen/DiscoverRequest"),
                type: "POST",
                data: JSON.stringify({
                    UserId: window.ApiClient._currentUser.Id,
                    MediaType: mediaType,
                    MediaId: mediaId,
                }),
                contentType: 'application/json; charset=utf-8',
                dataType: 'json'
            }).then(function (response) {
                if (response.errors && response.errors.length > 0) {
                    Dashboard.alert("Item request failed. Check browser logs for details.");
                    console.error("Item request failed. Response including errors:");
                    console.error(response);
                } else {
                    Dashboard.alert("Item successfully requested");
                }
            }, function (error) {
                Dashboard.alert("Item request failed");
            });
        }
    };

    $(document).ready(function () {
        setTimeout(function () {
            HomeScreenSectionsHandler.init();
        }, 50);
    });
}

if (typeof TopTenSectionHandler == 'undefined') {
    const TopTenSectionHandler = {
        init: function () {
            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
            var myObserver = new MutationObserver(this.mutationHandler);
            var observerConfig = { childList: true, characterData: true, attributes: true, subtree: true };

            $("body").each(function () {
                myObserver.observe(this, observerConfig);
            });
        },
        mutationHandler: function (mutationRecords) {
            mutationRecords.forEach(function (mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    [].some.call(mutation.addedNodes, function (addedNode) {
                        if ($(addedNode).hasClass('card')) {
                            if ($(addedNode).parents('.top-ten').length > 0) {
                                var index = parseInt($(addedNode).attr('data-index'));
                                $(addedNode).attr('data-number', index + 1);
                            }
                        }
                    });
                }
            });
        }
    }

    setTimeout(function () {
        TopTenSectionHandler.init();
    }, 50);
}
