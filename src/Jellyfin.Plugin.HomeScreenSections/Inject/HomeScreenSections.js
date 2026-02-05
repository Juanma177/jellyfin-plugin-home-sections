'use strict';

if (typeof HomeScreenSectionsHandler == 'undefined') {
    const HomeScreenSectionsHandler = {
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
                            $(addedNode).on('click', '.discover-card-link', HomeScreenSectionsHandler.cardLinkHandler);
                        }
                    });
                }
            });
        },
        cardLinkHandler: function (event) {
            event.preventDefault();
            event.stopPropagation();

            var $link = $(this);
            var tmdbId = parseInt($link.data('tmdb-id'));
            var mediaType = $link.data('media-type');
            var jellyseerrUrl = $link.data('jellyseerr-url');

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