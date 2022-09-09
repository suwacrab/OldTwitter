let user = {};
let settings;
let vars;
chrome.storage.sync.get(['linkColor', 'font', 'heartsNotStars', 'linkColorsInTL', 'enableTwemoji', 'disableHotkeys'], data => {
    vars = data;
});
let cursor;
let linkColors = {};
let listId = location.pathname.split('/')[3];
let subpage;
// Util

function updateSubpage() {
    Array.from(document.getElementsByClassName('list-switch')).forEach(el => el.classList.remove('list-switch-active'));
    document.getElementById('list-members-container').hidden = true;
    document.getElementById('list-tweets-container').hidden = true;
    document.getElementById('list-followers-container').hidden = true;
    end = false;
    cursor = undefined;

    if(location.href.endsWith('/members')) {
        subpage = 'members';
        document.getElementById('list-members-container').hidden = false;
        document.getElementById('list-members').innerHTML = '';
        document.getElementById('ns-members').classList.add('list-switch-active');
    } else if(location.href.endsWith('/followers')) {
        subpage = 'followers';
        document.getElementById('list-followers-container').hidden = false;
        document.getElementById('list-followers').innerHTML = '';
        document.getElementById('ns-followers').classList.add('list-switch-active');
    } else {
        subpage = 'tweets';
        document.getElementById('list-tweets-container').hidden = false;
        document.getElementById('list-tweets').innerHTML = '';
        document.getElementById('ns-tweets').classList.add('list-switch-active');
    }
}
function updateUserData() {
    API.verifyCredentials().then(u => {
        user = u;
        const event = new CustomEvent('updateUserData', { detail: u });
        document.dispatchEvent(event);
        renderUserData();
    }).catch(e => {
        if (e === "Not logged in") {
            window.location.href = "https://mobile.twitter.com/login";
        }
        console.error(e);
    });
}
// Render
function renderUserData() {
    document.getElementById('wtf-viewall').href = `https://mobile.twitter.com/i/connect_people?user_id=${user.id_str}`;
}

async function appendTweet(t, timelineContainer, options = {}) {
    const tweet = document.createElement('div');
    tweet.addEventListener('click', e => {
        if(e.target.className.startsWith('tweet tweet-id-') || e.target.className === 'tweet-body' || e.target.className === 'tweet-interact') {
            let tweet = t;
            if(tweet.retweeted_status) tweet = tweet.retweeted_status;
            new TweetViewer(user, settings, tweet);
        }
    });
    tweet.addEventListener('mousedown', e => {
        if(e.button === 1) {
            e.preventDefault();
            if(e.target.className.startsWith('tweet tweet-id-') || e.target.className === 'tweet-body' || e.target.className === 'tweet-interact') {
                openInNewTab(`https://twitter.com/${t.user.screen_name}/status/${t.id_str}`);
            }
        }
    });
    tweet.tabIndex = -1;
    tweet.className = `tweet tweet-id-${t.id_str} ${!activeTweet ? 'tweet-active' : ''}`;
    if(!activeTweet) {
        activeTweet = tweet;
    }
    if (options.selfThreadContinuation) tweet.classList.add('tweet-self-thread-continuation');
    if (options.noTop) tweet.classList.add('tweet-no-top');
    if(vars.linkColorsInTL) {
        if(linkColors[t.user.screen_name]) {
            let rgb = hex2rgb(linkColors[t.user.screen_name]);
            let ratio = contrast(rgb, [27, 40, 54]);
            if(ratio < 4 && vars.darkMode && linkColors[t.user.screen_name] !== '000000') {
                linkColors[t.user.screen_name] = colorShade(linkColors[t.user.screen_name], 80).slice(1);
            }
            tweet.style.setProperty('--link-color', '#'+linkColors[t.user.screen_name]);
        } else {
            if(t.user.profile_link_color && t.user.profile_link_color !== '1DA1F2') {
                let rgb = hex2rgb(t.user.profile_link_color);
                let ratio = contrast(rgb, [27, 40, 54]);
                if(ratio < 4 && vars.darkMode && linkColors[t.user.screen_name] !== '000000') {
                    t.user.profile_link_color = colorShade(t.user.profile_link_color, 80).slice(1);
                }
                tweet.style.setProperty('--link-color', '#'+t.user.profile_link_color);
            }
        }
    }
    let textWithoutLinks = t.full_text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').replace(/(?<!\w)@([\w+]{1,15}\b)/g, '');
    let isEnglish = textWithoutLinks.length < 1 ? {languages:[{language:'en', percentage:100}]} : await chrome.i18n.detectLanguage(textWithoutLinks);
    isEnglish = isEnglish.languages[0] && isEnglish.languages[0].percentage > 60 && isEnglish.languages[0].language.startsWith('en');
    tweet.innerHTML = /*html*/`
        <div class="tweet-top" hidden></div>
        <a class="tweet-avatar-link" href="https://twitter.com/${t.user.screen_name}"><img onerror="this.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_bigger.png'" src="${t.user.profile_image_url_https.replace("_normal.", "_bigger.")}" alt="${t.user.name}" class="tweet-avatar" width="48" height="48"></a>
        <div class="tweet-header">
            <a class="tweet-header-info" href="https://twitter.com/${t.user.screen_name}">
                <b class="tweet-header-name ${t.user.verified || t.user.id_str === '1123203847776763904' ? 'user-verified' : ''} ${t.user.protected ? 'user-protected' : ''}">${escapeHTML(t.user.name)}</b>
                <span class="tweet-header-handle">@${t.user.screen_name}</span>
            </a>
        </div>
        <a class="tweet-time" data-timestamp="${new Date(t.created_at).getTime()}" title="${new Date(t.created_at).toLocaleString()}" href="https://twitter.com/${t.user.screen_name}/status/${t.id_str}">${timeElapsed(new Date(t.created_at).getTime())}</a>
        <div class="tweet-body">
            <span class="tweet-body-text ${t.full_text && t.full_text.length > 100 ? 'tweet-body-text-long' : 'tweet-body-text-short'}">${t.full_text ? escapeHTML(t.full_text).replace(/\n/g, '<br>').replace(/((http|https|ftp):\/\/[\w?=&.\/-;#~%-]+(?![\w\s?&.\/;#~%"=-]*>))/g, '<a href="$1">$1</a>').replace(/(?<!\w)@([\w+]{1,15}\b)/g, `<a href="https://twitter.com/$1" target="_blank">@$1</a>`).replace(/(?<!\w)#([\w+]+\b)/g, `<a href="https://twitter.com/hashtag/$1">#$1</a>`) : ''}</span>
            ${!isEnglish ? `
            <br>
            <span class="tweet-translate">Translate tweet</span>
            ` : ``}
            ${t.extended_entities && t.extended_entities.media ? `
            <div class="tweet-media">
                ${t.extended_entities.media.map(m => `<${m.type === 'photo' ? 'img' : 'video'} ${m.ext_alt_text ? `alt="${escapeHTML(m.ext_alt_text)}" title="${escapeHTML(m.ext_alt_text)}"` : ''} crossorigin="anonymous" width="${sizeFunctions[t.extended_entities.media.length](m.original_info.width, m.original_info.height)[0]}" height="${sizeFunctions[t.extended_entities.media.length](m.original_info.width, m.original_info.height)[1]}" loading="lazy" ${m.type === 'video' ? 'controls' : ''} ${m.type === 'animated_gif' ? 'loop autoplay muted' : ''} ${m.type === 'photo' ? `src="${m.media_url_https}"` : ''} class="tweet-media-element ${mediaClasses[t.extended_entities.media.length]} ${!settings.display_sensitive_media && t.possibly_sensitive ? 'tweet-media-element-censor' : ''}">${m.type === 'video' || m.type === 'animated_gif' ? `
                    ${m.video_info.variants.map(v => `<source src="${v.url}" type="${v.content_type}">`).join('\n')}
                    Your browser does not support this video.
                </video>` : ''}`).join('\n')}
            </div>
            ` : ``}
            ${t.card ? `<div class="tweet-poll"></div>` : ''}
            ${t.quoted_status ? `
            <a class="tweet-body-quote" target="_blank" href="https://twitter.com/${t.quoted_status.user.screen_name}/status/${t.quoted_status.id_str}">
                <img src="${t.quoted_status.user.profile_image_url_https}" alt="${escapeHTML(t.quoted_status.user.name)}" class="tweet-avatar-quote" width="24" height="24">
                <div class="tweet-header-quote">
                    <span class="tweet-header-info-quote">
                        <b class="tweet-header-name-quote ${t.quoted_status.user.verified || t.quoted_status.user.id_str === '1123203847776763904' ? 'user-verified' : ''} ${t.quoted_status.user.protected ? 'user-protected' : ''}">${escapeHTML(t.quoted_status.user.name)}</b>
                        <span class="tweet-header-handle-quote">@${t.quoted_status.user.screen_name}</span>
                    </span>
                </div>
                <span class="tweet-time-quote" data-timestamp="${new Date(t.quoted_status.created_at).getTime()}" title="${new Date(t.quoted_status.created_at).toLocaleString()}">${timeElapsed(new Date(t.quoted_status.created_at).getTime())}</span>
                <span class="tweet-body-text-quote tweet-body-text-long" style="color:var(--default-text-color)!important">${t.quoted_status.full_text ? escapeHTML(t.quoted_status.full_text).replace(/\n/g, '<br>') : ''}</span>
                ${t.quoted_status.extended_entities && t.quoted_status.extended_entities.media ? `
                <div class="tweet-media-quote">
                    ${t.quoted_status.extended_entities.media.map(m => `<${m.type === 'photo' ? 'img' : 'video'} ${m.ext_alt_text ? `alt="${escapeHTML(m.ext_alt_text)}" title="${escapeHTML(m.ext_alt_text)}"` : ''} crossorigin="anonymous" width="${quoteSizeFunctions[t.quoted_status.extended_entities.media.length](m.original_info.width, m.original_info.height)[0]}" height="${quoteSizeFunctions[t.quoted_status.extended_entities.media.length](m.original_info.width, m.original_info.height)[1]}" loading="lazy" ${m.type === 'video' ? 'controls' : ''} ${m.type === 'animated_gif' ? 'loop autoplay muted' : ''} src="${m.type === 'photo' ? m.media_url_https : m.video_info.variants.find(v => v.content_type === 'video/mp4').url}" class="tweet-media-element tweet-media-element-quote ${mediaClasses[t.quoted_status.extended_entities.media.length]} ${!settings.display_sensitive_media && t.quoted_status.possibly_sensitive ? 'tweet-media-element-censor' : ''}">${m.type === 'video' ? '</video>' : ''}`).join('\n')}
                </div>
                ` : ''}
            </a>
            ` : ``}
            ${options.selfThreadButton && t.self_thread.id_str ? `<br><a class="tweet-self-thread-button" href="https://twitter.com/${t.user.screen_name}/status/${t.self_thread.id_str}">Show this thread</a>` : ``}
            <div class="tweet-interact">
                <span class="tweet-interact-reply" data-val="${t.reply_count}">${t.reply_count}</span>
                <span class="tweet-interact-retweet ${t.retweeted ? 'tweet-interact-retweeted' : ''}" data-val="${t.retweet_count}">${t.retweet_count}</span>
                <div class="tweet-interact-retweet-menu" hidden>
                    <span class="tweet-interact-retweet-menu-retweet">${t.retweeted ? 'Unretweet' : 'Retweet'}</span><br>
                    <span class="tweet-interact-retweet-menu-quote">Quote tweet</span>
                </div>
                <span class="tweet-interact-favorite ${t.favorited ? 'tweet-interact-favorited' : ''}" data-val="${t.favorite_count}">${t.favorite_count}</span>
                <span class="tweet-interact-more"></span>
                <div class="tweet-interact-more-menu" hidden>
                    <span class="tweet-interact-more-menu-copy">Copy link</span><br>
                    <span class="tweet-interact-more-menu-embed">Embed tweet</span><br>
                    <span class="tweet-interact-more-menu-share">Share tweet</span><br>
                    ${t.user.id_str === user.id_str ? `
                    <hr>
                    <span class="tweet-interact-more-menu-analytics">Tweet analytics</span><br>
                    <span class="tweet-interact-more-menu-delete">Delete tweet</span><br>
                    ` : `
                    <hr>
                    <span class="tweet-interact-more-menu-follow">${t.user.following ? 'Unfollow' : 'Follow'} @${t.user.screen_name}</span><br>
                    `}
                    <span class="tweet-interact-more-menu-bookmark">Bookmark tweet</span>
                    <hr>
                    <span class="tweet-interact-more-menu-refresh">Refresh tweet data</span><br>
                    ${t.extended_entities && t.extended_entities.media.length === 1 ? `<span class="tweet-interact-more-menu-download">Download media</span><br>` : ``}
                    ${t.extended_entities && t.extended_entities.media.length === 1 && t.extended_entities.media[0].type === 'animated_gif' ? `<span class="tweet-interact-more-menu-download-gif">Download as GIF</span><br>` : ``}
                </div>
            </div>
            <div class="tweet-reply" hidden>
                <br>
                <b style="font-size: 12px;display: block;margin-bottom: 5px;">Replying to tweet <span class="tweet-reply-upload">[upload media]</span> <span class="tweet-reply-cancel">[cancel]</span></b>
                <span class="tweet-reply-error" style="color:red"></span>
                <textarea maxlength="280" class="tweet-reply-text" placeholder="Cool reply tweet"></textarea>
                <button class="tweet-reply-button nice-button">Reply</button><br>
                <span class="tweet-reply-char">0/280</span><br>
                <div class="tweet-reply-media" style="padding-bottom: 10px;"></div>
            </div>
            <div class="tweet-quote" hidden>
                <br>
                <b style="font-size: 12px;display: block;margin-bottom: 5px;">Quote tweet <span class="tweet-quote-upload">[upload media]</span> <span class="tweet-quote-cancel">[cancel]</span></b>
                <span class="tweet-quote-error" style="color:red"></span>
                <textarea maxlength="280" class="tweet-quote-text" placeholder="Cool quote tweet"></textarea>
                <button class="tweet-quote-button nice-button">Quote</button><br>
                <span class="tweet-quote-char">0/280</span><br>
                <div class="tweet-quote-media" style="padding-bottom: 10px;"></div>
            </div>
            <div class="tweet-self-thread-div" ${options.selfThreadContinuation && t.self_thread.id_str ? '' : 'hidden'}>
                <span class="tweet-self-thread-line"></span>
                <div class="tweet-self-thread-line-dots"></div>
                <br>${options.selfThreadContinuation && t.self_thread.id_str ? `<a class="tweet-self-thread-button" href="https://twitter.com/${t.user.screen_name}/status/${t.self_thread.id_str}">Show this thread</a>` : `<br>`}
            </div>
        </div>
    `;
    if(t.card) {
        generateCard(t, tweet, user);
    }
    if (options.top) {
        tweet.querySelector('.tweet-top').hidden = false;
        const icon = document.createElement('span');
        icon.innerText = options.top.icon;
        icon.classList.add('tweet-top-icon');
        icon.style.color = options.top.color;

        const span = document.createElement("span");
        span.classList.add("tweet-top-text");
        span.innerHTML = options.top.text;
        tweet.querySelector('.tweet-top').append(icon, span);
    }
    const tweetBodyText = tweet.getElementsByClassName('tweet-body-text')[0];
    const tweetTranslate = tweet.getElementsByClassName('tweet-translate')[0];

    const tweetReplyCancel = tweet.getElementsByClassName('tweet-reply-cancel')[0];
    const tweetReplyUpload = tweet.getElementsByClassName('tweet-reply-upload')[0];
    const tweetReply = tweet.getElementsByClassName('tweet-reply')[0];
    const tweetReplyButton = tweet.getElementsByClassName('tweet-reply-button')[0];
    const tweetReplyError = tweet.getElementsByClassName('tweet-reply-error')[0];
    const tweetReplyText = tweet.getElementsByClassName('tweet-reply-text')[0];
    const tweetReplyChar = tweet.getElementsByClassName('tweet-reply-char')[0];
    const tweetReplyMedia = tweet.getElementsByClassName('tweet-reply-media')[0];

    const tweetInteractReply = tweet.getElementsByClassName('tweet-interact-reply')[0];
    const tweetInteractRetweet = tweet.getElementsByClassName('tweet-interact-retweet')[0];
    const tweetInteractFavorite = tweet.getElementsByClassName('tweet-interact-favorite')[0];
    const tweetInteractMore = tweet.getElementsByClassName('tweet-interact-more')[0];

    const tweetQuote = tweet.getElementsByClassName('tweet-quote')[0];
    const tweetQuoteCancel = tweet.getElementsByClassName('tweet-quote-cancel')[0];
    const tweetQuoteUpload = tweet.getElementsByClassName('tweet-quote-upload')[0];
    const tweetQuoteButton = tweet.getElementsByClassName('tweet-quote-button')[0];
    const tweetQuoteError = tweet.getElementsByClassName('tweet-quote-error')[0];
    const tweetQuoteText = tweet.getElementsByClassName('tweet-quote-text')[0];
    const tweetQuoteChar = tweet.getElementsByClassName('tweet-quote-char')[0];
    const tweetQuoteMedia = tweet.getElementsByClassName('tweet-quote-media')[0];

    const tweetInteractRetweetMenu = tweet.getElementsByClassName('tweet-interact-retweet-menu')[0];
    const tweetInteractRetweetMenuRetweet = tweet.getElementsByClassName('tweet-interact-retweet-menu-retweet')[0];
    const tweetInteractRetweetMenuQuote = tweet.getElementsByClassName('tweet-interact-retweet-menu-quote')[0];

    const tweetInteractMoreMenu = tweet.getElementsByClassName('tweet-interact-more-menu')[0];
    const tweetInteractMoreMenuCopy = tweet.getElementsByClassName('tweet-interact-more-menu-copy')[0];
    const tweetInteractMoreMenuEmbed = tweet.getElementsByClassName('tweet-interact-more-menu-embed')[0];
    const tweetInteractMoreMenuShare = tweet.getElementsByClassName('tweet-interact-more-menu-share')[0];
    const tweetInteractMoreMenuAnalytics = tweet.getElementsByClassName('tweet-interact-more-menu-analytics')[0];
    const tweetInteractMoreMenuRefresh = tweet.getElementsByClassName('tweet-interact-more-menu-refresh')[0];
    const tweetInteractMoreMenuDownload = tweet.getElementsByClassName('tweet-interact-more-menu-download')[0];
    const tweetInteractMoreMenuDownloadGif = tweet.getElementsByClassName('tweet-interact-more-menu-download-gif')[0];
    const tweetInteractMoreMenuDelete = tweet.getElementsByClassName('tweet-interact-more-menu-delete')[0];
    const tweetInteractMoreMenuFollow = tweet.getElementsByClassName('tweet-interact-more-menu-follow')[0];
    const tweetInteractMoreMenuBookmark = tweet.getElementsByClassName('tweet-interact-more-menu-bookmark')[0];

    // Translate
    if(tweetTranslate) tweetTranslate.addEventListener('click', async () => {
        let translated = await API.translateTweet(t.id_str);
        tweetTranslate.hidden = true;
        tweetBodyText.innerHTML += `<br>
        <span style="font-size: 12px;color: var(--light-gray);">Translated from [${translated.translated_lang}]:</span>
        <br>
        <span>${escapeHTML(translated.text)}</span>`;
        if(vars.enableTwemoji) twemoji.parse(tweetBodyText);
    });

    tweetInteractMoreMenuBookmark.addEventListener('click', async () => {
        API.createBookmark(t.id_str);
    });

    // Media
    if (t.extended_entities && t.extended_entities.media) {
        const tweetMedia = tweet.getElementsByClassName('tweet-media')[0];
        tweetMedia.addEventListener('click', e => {
            if (e.target.className.includes('tweet-media-element-censor')) {
                return e.target.classList.remove('tweet-media-element-censor');
            }
            if (e.target.tagName === 'IMG') {
                new Viewer(tweetMedia);
                e.target.click();
            }
        });
    }

    // Links
    if (tweetBodyText && tweetBodyText.lastChild && tweetBodyText.lastChild.href && tweetBodyText.lastChild.href.startsWith('https://t.co/')) {
        if (t.entities.urls.length === 0 || t.entities.urls[t.entities.urls.length - 1].url !== tweetBodyText.lastChild.href) {
            tweetBodyText.lastChild.remove();
        }
    }
    let links = Array.from(tweetBodyText.getElementsByTagName('a')).filter(a => a.href.startsWith('https://t.co/'));
    links.forEach(a => {
        let link = t.entities.urls.find(u => u.url === a.href);
        if (link) {
            a.innerText = link.display_url;
            a.href = link.expanded_url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
    });

    // Reply
    tweetReplyCancel.addEventListener('click', () => {
        tweetReply.hidden = true;
        tweetInteractReply.classList.remove('tweet-interact-reply-clicked');
    });
    let replyMedia = [];
    tweetReply.addEventListener('drop', e => {
        handleDrop(e, replyMedia, tweetReplyMedia);
    });
    tweetReplyUpload.addEventListener('click', () => {
        getMedia(replyMedia, tweetReplyMedia);
    });
    tweetInteractReply.addEventListener('click', () => {
        if (!tweetQuote.hidden) tweetQuote.hidden = true;
        if (tweetReply.hidden) {
            tweetInteractReply.classList.add('tweet-interact-reply-clicked');
        } else {
            tweetInteractReply.classList.remove('tweet-interact-reply-clicked');
        }
        tweetReply.hidden = !tweetReply.hidden;
        setTimeout(() => {
            tweetReplyText.focus();
        })
    });
    tweetReplyText.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.ctrlKey) {
            tweetReplyButton.click();
        }
        tweetReplyChar.innerText = `${tweetReplyText.value.length}/280`;
        if(tweetReplyText.value.length > 265) {
            tweetReplyChar.style.color = "#c26363";
        } else {
            tweetReplyChar.style.color = "";
        }
    });
    tweetReplyText.addEventListener('keyup', e => {
        tweetReplyChar.innerText = `${tweetReplyText.value.length}/280`;
        if(tweetReplyText.value.length > 265) {
            tweetReplyChar.style.color = "#c26363";
        } else {
            tweetReplyChar.style.color = "";
        }
    });
    tweetReplyButton.addEventListener('click', async () => {
        tweetReplyError.innerHTML = '';
        let text = tweetReplyText.value;
        if (text.length === 0 && replyMedia.length === 0) return;
        tweetReplyButton.disabled = true;
        let uploadedMedia = [];
        for (let i in replyMedia) {
            let media = replyMedia[i];
            try {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = false;
                let mediaId = await API.uploadMedia({
                    media_type: media.type,
                    media_category: media.category,
                    media: media.data,
                    alt: media.alt,
                    loadCallback: data => {
                        media.div.getElementsByClassName('new-tweet-media-img-progress')[0].innerText = `${data.text} (${data.progress}%)`;
                    }
                });
                uploadedMedia.push(mediaId);
            } catch (e) {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = true;
                console.error(e);
                alert(e);
            }
        }
        let tweetObject = {
            status: text,
            in_reply_to_status_id: t.id_str,
            auto_populate_reply_metadata: true,
            batch_mode: 'off',
            exclude_reply_user_ids: '',
            cards_platform: 'Web-13',
            include_entities: 1,
            include_user_entities: 1,
            include_cards: 1,
            send_error_codes: 1,
            tweet_mode: 'extended',
            include_ext_alt_text: true,
            include_reply_count: true
        };
        if (uploadedMedia.length > 0) {
            tweetObject.media_ids = uploadedMedia.join(',');
        }
        let tweetData;
        try {
            tweetData = await API.postTweet(tweetObject)
        } catch (e) {
            tweetReplyError.innerHTML = (e && e.message ? e.message : e) + "<br>";
            tweetReplyButton.disabled = false;
            return;
        }
        if (!tweetData) {
            tweetReplyButton.disabled = false;
            tweetReplyError.innerHTML = "Error sending tweet<br>";
            return;
        }
        tweetReplyText.value = '';
        tweetReply.hidden = true;
        tweetInteractReply.classList.remove('tweet-interact-reply-clicked');
        tweetInteractReply.dataset.val = parseInt(tweetInteractReply.innerText) + 1;
        tweetInteractReply.innerText = parseInt(tweetInteractReply.innerText) + 1;
        tweetData._ARTIFICIAL = true;
        timeline.data.unshift(tweetData);
        tweet.getElementsByClassName('tweet-self-thread-div')[0].hidden = false;
        tweetReplyButton.disabled = false;
        tweetReplyMedia.innerHTML = [];
        replyMedia = [];
    });

    // Retweet / Quote Tweet
    let retweetClicked = false;
    tweetQuoteCancel.addEventListener('click', () => {
        tweetQuote.hidden = true;
    });
    tweetInteractRetweet.addEventListener('click', async () => {
        if (!tweetQuote.hidden) {
            tweetQuote.hidden = true;
            return;
        }
        if (tweetInteractRetweetMenu.hidden) {
            tweetInteractRetweetMenu.hidden = false;
        }
        if(retweetClicked) return;
        retweetClicked = true;
        setTimeout(() => {
            document.body.addEventListener('click', () => {
                retweetClicked = false;
                setTimeout(() => tweetInteractRetweetMenu.hidden = true, 50);
            }, { once: true });
        }, 50);
    });
    tweetInteractRetweetMenuRetweet.addEventListener('click', async () => {
        if (!t.retweeted) {
            let tweetData;
            try {
                tweetData = await API.retweetTweet(t.id_str);
            } catch (e) {
                console.error(e);
                return;
            }
            if (!tweetData) {
                return;
            }
            tweetInteractRetweetMenuRetweet.innerText = 'Unretweet';
            tweetInteractRetweet.classList.add('tweet-interact-retweeted');
            tweetInteractRetweet.dataset.val = parseInt(tweetInteractRetweet.innerText) + 1;
            tweetInteractRetweet.innerText = parseInt(tweetInteractRetweet.innerText) + 1;
            t.retweeted = true;
            t.newTweetId = tweetData.id_str;
        } else {
            let tweetData;
            try {
                tweetData = await API.deleteTweet(t.current_user_retweet ? t.current_user_retweet.id_str : t.newTweetId);
            } catch (e) {
                console.error(e);
                return;
            }
            if (!tweetData) {
                return;
            }
            tweetInteractRetweetMenuRetweet.innerText = 'Retweet';
            tweetInteractRetweet.classList.remove('tweet-interact-retweeted');
            tweetInteractRetweet.dataset.val = parseInt(tweetInteractRetweet.innerText) - 1;
            tweetInteractRetweet.innerText = parseInt(tweetInteractRetweet.innerText) - 1;
            t.retweeted = false;
            delete t.newTweetId;
        }
    });
    tweetInteractRetweetMenuQuote.addEventListener('click', async () => {
        if (!tweetReply.hidden) {
            tweetInteractReply.classList.remove('tweet-interact-reply-clicked');
            tweetReply.hidden = true;
        }
        tweetQuote.hidden = false;
        setTimeout(() => {
            tweetQuoteText.focus();
        })
    });
    let quoteMedia = [];
    tweetQuote.addEventListener('drop', e => {
        handleDrop(e, quoteMedia, tweetQuoteMedia);
    });
    tweetQuoteUpload.addEventListener('click', () => {
        getMedia(quoteMedia, tweetQuoteMedia);
    });
    tweetQuoteText.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.ctrlKey) {
            tweetQuoteButton.click();
        }
        tweetQuoteChar.innerText = `${tweetQuoteText.value.length}/280`;
        if(tweetQuoteText.value.length > 265) {
            tweetQuoteChar.style.color = "#c26363";
        } else {
            tweetQuoteChar.style.color = "";
        }
    });
    tweetQuoteText.addEventListener('keyup', e => {
        tweetQuoteChar.innerText = `${tweetQuoteText.value.length}/280`;
        if(tweetQuoteText.value.length > 265) {
            tweetQuoteChar.style.color = "#c26363";
        } else {
            tweetQuoteChar.style.color = "";
        }
    });
    tweetQuoteButton.addEventListener('click', async () => {
        let text = tweetQuoteText.value;
        tweetQuoteError.innerHTML = '';
        if (text.length === 0 && quoteMedia.length === 0) return;
        tweetQuoteButton.disabled = true;
        let uploadedMedia = [];
        for (let i in quoteMedia) {
            let media = quoteMedia[i];
            try {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = false;
                let mediaId = await API.uploadMedia({
                    media_type: media.type,
                    media_category: media.category,
                    media: media.data,
                    alt: media.alt,
                    loadCallback: data => {
                        media.div.getElementsByClassName('new-tweet-media-img-progress')[0].innerText = `${data.text} (${data.progress}%)`;
                    }
                });
                uploadedMedia.push(mediaId);
            } catch (e) {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = true;
                console.error(e);
                alert(e);
            }
        }
        let tweetObject = {
            status: text,
            attachment_url: `https://twitter.com/${t.user.screen_name}/status/${t.id_str}`,
            auto_populate_reply_metadata: true,
            batch_mode: 'off',
            exclude_reply_user_ids: '',
            cards_platform: 'Web-13',
            include_entities: 1,
            include_user_entities: 1,
            include_cards: 1,
            send_error_codes: 1,
            tweet_mode: 'extended',
            include_ext_alt_text: true,
            include_reply_count: true
        };
        if (uploadedMedia.length > 0) {
            tweetObject.media_ids = uploadedMedia.join(',');
        }
        let tweetData;
        try {
            tweetData = await API.postTweet(tweetObject)
        } catch (e) {
            tweetQuoteError.innerHTML = (e && e.message ? e.message : e) + "<br>";
            tweetQuoteButton.disabled = false;
            return;
        }
        if (!tweetData) {
            tweetQuoteError.innerHTML = "Error sending tweet<br>";
            tweetQuoteButton.disabled = false;
            return;
        }
        tweetQuoteText.value = '';
        tweetQuote.hidden = true;
        tweetData._ARTIFICIAL = true;
        quoteMedia = [];
        tweetQuoteButton.disabled = false;
        tweetQuoteMedia.innerHTML = '';
        timeline.data.unshift(tweetData);
    });

    // Favorite
    tweetInteractFavorite.addEventListener('click', () => {
        if (t.favorited) {
            API.unfavoriteTweet({
                id: t.id_str
            });
            t.favorited = false;
            t.favorite_count--;
            tweetInteractFavorite.dataset.val = parseInt(tweetInteractFavorite.innerText) - 1;
            tweetInteractFavorite.innerText = parseInt(tweetInteractFavorite.innerText) - 1;
            tweetInteractFavorite.classList.remove('tweet-interact-favorited');
        } else {
            API.favoriteTweet({
                id: t.id_str
            });
            t.favorited = true;
            t.favorite_count++;
            tweetInteractFavorite.dataset.val = parseInt(tweetInteractFavorite.innerText) + 1;
            tweetInteractFavorite.innerText = parseInt(tweetInteractFavorite.innerText) + 1;
            tweetInteractFavorite.classList.add('tweet-interact-favorited');
        }
    });

    // More
    let moreClicked = false;
    tweetInteractMore.addEventListener('click', () => {
        if (tweetInteractMoreMenu.hidden) {
            tweetInteractMoreMenu.hidden = false;
        }
        if(moreClicked) return;
        moreClicked = true;
        setTimeout(() => {
            document.body.addEventListener('click', () => {
                moreClicked = false;
                setTimeout(() => tweetInteractMoreMenu.hidden = true, 50);
            }, { once: true });
        }, 50);
    });
    if(tweetInteractMoreMenuFollow) tweetInteractMoreMenuFollow.addEventListener('click', async () => {
        if (t.user.following) {
            await API.unfollowUser(t.user.screen_name);
            t.user.following = false;
            tweetInteractMoreMenuFollow.innerText = `Follow @${t.user.screen_name}`;
        } else {
            await API.followUser(t.user.screen_name);
            t.user.following = true;
            tweetInteractMoreMenuFollow.innerText = `Unfollow @${t.user.screen_name}`;
        }
    });
    tweetInteractMoreMenuCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(`https://twitter.com/${t.user.screen_name}/status/${t.id_str}`);
    });
    tweetInteractMoreMenuShare.addEventListener('click', () => {
        navigator.share({ url: `https://twitter.com/${t.user.screen_name}/status/${t.id_str}` });
    });
    tweetInteractMoreMenuEmbed.addEventListener('click', () => {
        openInNewTab(`https://publish.twitter.com/?query=https://twitter.com/${t.user.screen_name}/status/${t.id_str}&widget=Tweet`);
    });
    if (t.user.id_str === user.id_str) {
        tweetInteractMoreMenuAnalytics.addEventListener('click', () => {
            openInNewTab(`https://mobile.twitter.com/dimdenEFF/status/${t.id_str}/analytics`);
        });
        tweetInteractMoreMenuDelete.addEventListener('click', async () => {
            let sure = confirm("Are you sure you want to delete this tweet?");
            if (!sure) return;
            try {
                await API.deleteTweet(t.id_str);
            } catch (e) {
                alert(e);
                console.error(e);
                return;
            }
            if(options.after) {
                options.after.getElementsByClassName('tweet-self-thread-div')[0].hidden = true;
                options.after.getElementsByClassName('tweet-interact-reply')[0].innerText = (+options.after.getElementsByClassName('tweet-interact-reply')[0].innerText - 1).toString();
            }
            Array.from(document.getElementById('list-tweets').getElementsByClassName(`tweet-id-${t.id_str}`)).forEach(tweet => {
                tweet.remove();
            });
        });
    }
    tweetInteractMoreMenuRefresh.addEventListener('click', async () => {
        let tweetData;
        try {
            tweetData = await API.getTweet(t.id_str);
        } catch (e) {
            console.error(e);
            return;
        }
        if (!tweetData) {
            return;
        }
        let tweetIndex = timeline.data.findIndex(tweet => tweet.id_str === t.id_str);
        if (tweetIndex !== -1) {
            timeline.data[tweetIndex] = tweetData;
        }
        if (tweetInteractFavorite.className.includes('tweet-interact-favorited') && !tweetData.favorited) {
            tweetInteractFavorite.classList.remove('tweet-interact-favorited');
        }
        if (tweetInteractRetweet.className.includes('tweet-interact-retweeted') && !tweetData.retweeted) {
            tweetInteractRetweet.classList.remove('tweet-interact-retweeted');
        }
        if (!tweetInteractFavorite.className.includes('tweet-interact-favorited') && tweetData.favorited) {
            tweetInteractFavorite.classList.add('tweet-interact-favorited');
        }
        if (!tweetInteractRetweet.className.includes('tweet-interact-retweeted') && tweetData.retweeted) {
            tweetInteractRetweet.classList.add('tweet-interact-retweeted');
        }
        tweetInteractFavorite.innerText = tweetData.favorite_count;
        tweetInteractRetweet.innerText = tweetData.retweet_count;
        tweetInteractReply.innerText = tweetData.reply_count;
    });
    let downloading = false;
    if (t.extended_entities && t.extended_entities.media.length === 1) {
        tweetInteractMoreMenuDownload.addEventListener('click', () => {
            if (downloading) return;
            downloading = true;
            let media = t.extended_entities.media[0];
            let url = media.type === 'photo' ? media.media_url_https : media.video_info.variants[0].url;
            fetch(url).then(res => res.blob()).then(blob => {
                downloading = false;
                let a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = media.type === 'photo' ? media.media_url_https.split('/').pop() : media.video_info.variants[0].url.split('/').pop();
                a.download = a.download.split('?')[0];
                a.click();
                a.remove();
            }).catch(e => {
                downloading = false;
                console.error(e);
            });
        });
        if (t.extended_entities.media[0].type === 'animated_gif') {
            tweetInteractMoreMenuDownloadGif.addEventListener('click', () => {
                if (downloading) return;
                downloading = true;
                let video = tweet.getElementsByClassName('tweet-media-element')[0];
                let canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                let ctx = canvas.getContext('2d');
                if (video.duration > 10 && !confirm('This video is longer than 10 seconds. Are you sure you want to convert it, might lag')) {
                    return downloading = false;
                }
                let gif = new GIF({
                    workers: 2,
                    quality: 10
                });
                video.currentTime = 0;
                video.loop = false;
                let isFirst = true;
                let interval = setInterval(async () => {
                    if(isFirst) {
                        video.currentTime = 0;
                        isFirst = false;
                        await sleep(5);
                    }
                    if (video.currentTime+0.1 >= video.duration) {
                        clearInterval(interval);
                        gif.on('finished', blob => {
                            let a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `${t.id_str}.gif`;
                            document.body.append(a);
                            a.click();
                            a.remove();
                            downloading = false;
                            video.loop = true;
                            video.play();
                        });
                        gif.render();
                        return;
                    }
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    gif.addFrame(imgData, { delay: 100 });
                }, 100);
            });
        }
    }

    if(options.after) {
        options.after.after(tweet);
    } else if (options.prepend) {
        timelineContainer.prepend(tweet);
    } else {
        timelineContainer.append(tweet);
    }
    if(vars.enableTwemoji) twemoji.parse(tweet);
    return tweet;
}

async function renderDiscovery(cache = true) {
    let discover = await API.discoverPeople(cache);
    let discoverContainer = document.getElementById('wtf-list');
    discoverContainer.innerHTML = '';
    try {
        let max = 7;
        if(innerHeight < 650) max = 5;
        let usersData = discover.globalObjects.users;
        let usersSuggestions = discover.timeline.instructions[0].addEntries.entries[0].content.timelineModule.items.map(s => s.entryId.slice('user-'.length)).slice(0, max); // why is it so deep
        usersSuggestions.slice(0, 5).forEach(userId => {
            let userData = usersData[userId];
            if (!userData) return;
            let udiv = document.createElement('div');
            udiv.className = 'wtf-user';
            udiv.innerHTML = `
                <a class="tweet-avatar-link" href="https://twitter.com/${userData.screen_name}"><img src="${userData.profile_image_url_https.replace("_normal", "_bigger")}" alt="${escapeHTML(userData.name)}" class="tweet-avatar" width="48" height="48"></a>
                <div class="tweet-header wtf-header">
                    <a class="tweet-header-info wtf-user-link" href="https://twitter.com/${userData.screen_name}">
                        <b class="tweet-header-name wtf-user-name">${escapeHTML(userData.name)}</b>
                        <span class="tweet-header-handle wtf-user-handle">@${userData.screen_name}</span>
                    </a>
                    <br>
                    <button class="nice-button discover-follow-btn ${userData.following ? 'following' : 'follow'}" style="position:relative;bottom: 1px;">${userData.following ? 'Following' : 'Follow'}</button>
                </div>
            `;
            const followBtn = udiv.querySelector('.discover-follow-btn');
            followBtn.addEventListener('click', async () => {
                if (followBtn.className.includes('following')) {
                    await API.unfollowUser(userData.screen_name);
                    followBtn.classList.remove('following');
                    followBtn.classList.add('follow');
                    followBtn.innerText = 'Follow';
                    userData.following = false;
                } else {
                    await API.followUser(userData.screen_name);
                    followBtn.classList.add('following');
                    followBtn.classList.remove('follow');
                    followBtn.innerText = 'Following';
                    userData.following = true;
                }
                chrome.storage.local.set({
                    discoverData: {
                        date: Date.now(),
                        data: discover
                    }
                }, () => { })
            });
            discoverContainer.append(udiv);
            twemoji.parse(udiv);
        });
    } catch (e) {
        console.warn(e);
    }
}
function renderListData(data) {
    console.log(data);
    if(data.custom_banner_media) {
        document.getElementById('list-banner').src = data.custom_banner_media.media_info.original_img_url;
    } else {
        document.getElementById('list-banner').src = data.default_banner_media.media_info.original_img_url;
    }
    document.getElementById('list-name').innerText = data.name;
    document.getElementById('list-name').classList.toggle('user-protected', data.mode === 'Private');
    document.getElementById('list-description').innerText = data.description;
    document.getElementById('list-members-count').innerText = data.member_count;
    document.getElementById('list-followers-count').innerText = data.subscriber_count;
    if(data.user_results && data.user_results.result) {
        document.getElementById('list-user').href = `https://twitter.com/${data.user_results.result.legacy.screen_name}/lists`;
        document.getElementById('list-avatar').src = data.user_results.result.legacy.profile_image_url_https.replace('_normal', '_bigger');
        let actions = document.getElementById('list-actions');
        actions.innerHTML = ``;
        if(data.user_results.result.rest_id === user.id_str) {
            actions.innerHTML = `
                <button class="nice-button" id="list-btn-edit">Edit</button>
                <button class="nice-button" id="list-btn-delete">Delete</button>
            `;
            document.getElementById('list-btn-edit').addEventListener('click', () => {
                let modal = createModal(`
                    <div id="list-editor">
                        <h1 class="cool-header">Edit list</h1><br>
                        <span id="list-editor-error" style="color:red"></span><br>
                        Name:<br><input maxlength="25" type="text" id="list-name-input" value="${escapeHTML(data.name)}"><br><br>
                        Description:<br><textarea maxlength="100" type="text" id="list-description-input">${escapeHTML(data.description)}</textarea><br>
                        <br>
                        Is private: <input type="checkbox" style="width: 15px;" id="list-private-input" ${data.mode === 'Private' ? 'checked' : ''}><br>
                        <br>
                        <button class="nice-button" id="list-btn-save">Save</button> 
                        <button class="nice-button" id="list-btn-members">Edit members</button>
                    </div>
                    <div id="list-editor-members" hidden>
                        <h1 class="cool-header">Edit list members</h1>
                        <span id='list-editor-members-back'>Back</span>
                        <br>
                        <div id="list-editor-members-container"></div>
                        <div class="box" style="border-bottom:none"></div>
                        <div id="list-editor-members-more" class="center-text" style="padding-left: 90px;">Load more</div>
                    </div>
                `, 'list-editor-modal');
                document.getElementById('list-btn-save').addEventListener('click', async () => {
                    document.getElementById('list-editor-error').innerText = '';
                    let name = document.getElementById('list-name-input').value;
                    let description = document.getElementById('list-description-input').value;
                    let isPrivate = document.getElementById('list-private-input').checked;
                    try {
                        await API.updateList(data.id_str, name, description, isPrivate);
                        document.getElementById('list-name').classList.toggle('user-protected', isPrivate);
                    } catch(e) {
                        return document.getElementById('list-editor-error').innerText = e && e.message ? e.message : e;
                    }
                    modal.remove();
                    renderListData(await API.getList(data.id_str));
                });
                let membersCursor;
                let membersContainer = document.getElementById('list-editor-members-container');
                async function getMembers() {
                    let listMembers = await API.getListMembers(data.id_str, membersCursor);
                    membersCursor = listMembers.cursor;
                    listMembers = listMembers.list;
                    if(!cursor || listMembers.length === 0) document.getElementById('list-editor-members-more').hidden = true;
                    for(let i in listMembers) {
                        let t = listMembers[i];
                        let followingElement = document.createElement('div');
                        followingElement.classList.add('following-item');
                        followingElement.innerHTML = `
                        <div style="height:48px">
                            <a href="https://twitter.com/${t.screen_name}" class="following-item-link">
                                <img src="${t.profile_image_url_https}" alt="${t.screen_name}" class="following-item-avatar tweet-avatar" width="48" height="48">
                                <div class="following-item-text">
                                    <span class="tweet-header-name following-item-name">${escapeHTML(t.name)}</span><br>
                                    <span class="tweet-header-handle">@${t.screen_name}</span>
                                </div>
                            </a>
                        </div>
                        <div>
                            <button class="following-item-btn nice-button">Remove</button>
                        </div>`;

                        let removeButton = followingElement.querySelector('.following-item-btn');
                        removeButton.addEventListener('click', async () => {
                            await API.listRemoveMember(listId, t.id_str);
                            document.getElementById('list-members-count').innerText = parseInt(document.getElementById('list-members-count').innerText) - 1;
                            followingElement.remove();
                        });

                        membersContainer.appendChild(followingElement);
                    }
                }
                document.getElementById('list-btn-members').addEventListener('click', async () => {
                    document.getElementById('list-editor').hidden = true;
                    document.getElementById('list-editor-members').hidden = false;
                    getMembers();
                });
                document.getElementById('list-editor-members-more').addEventListener('click', getMembers);
                document.getElementById('list-editor-members-back').addEventListener('click', () => {
                    document.getElementById('list-editor').hidden = false;
                    document.getElementById('list-editor-members').hidden = true;
                });
            });
            document.getElementById('list-btn-delete').addEventListener('click', async () => {
                let modal = createModal(`
                    <h1 class="cool-header">Delete list</h1><br>
                    <span>Are you sure you want to delete this list?</span>
                    <br><br>
                    <button class="nice-button" id="list-btn-delete-confirm">Delete</button>
                `, 'list-editor-modal');
                document.getElementById('list-btn-delete-confirm').addEventListener('click', async () => {
                    await API.deleteList(data.id_str);
                    modal.remove();
                    window.location.href = `https://twitter.com/${user.screen_name}/lists`;
                });
            });
        } else {
            actions.innerHTML = `<button class="nice-button" id="list-btn-subscribe">${data.following ? 'Unsubscribe' : 'Subscribe'}</button>`;
            document.getElementById('list-btn-subscribe').addEventListener('click', async () => {
                if(data.following) {
                    await API.unsubscribeList(data.id_str);
                    document.getElementById('list-followers-count').innerText = +document.getElementById('list-followers-count').innerText - 1;
                    data.following = false;
                    document.getElementById('list-btn-subscribe').innerText = 'Subscribe';
                } else {
                    await API.subscribeList(data.id_str);
                    document.getElementById('list-followers-count').innerText = +document.getElementById('list-followers-count').innerText + 1;
                    data.following = true;
                    document.getElementById('list-btn-subscribe').innerText = 'Unsubscribe';
                }
            });
        }
    }
}
async function renderListTweets(c) {
    let [listInfo, listTweets, settingsData] = await Promise.allSettled([
        API.getList(listId),
        API.getListTweets(listId, c),
        API.getSettings()
    ]).catch(e => {
        console.error(e);
    });
    if(listTweets.reason) {
        console.error(listTweets.reason);
        document.getElementById('loading-box-error').innerHTML = `List was not found.<br><a href="https://twitter.com/home">Go to homepage</a>`;
        return false;
    }
    listInfo = listInfo.value;
    listTweets = listTweets.value;
    settings = settingsData.value;
    cursor = listTweets.cursor;
    listTweets = listTweets.list;
    if(!cursor || listTweets.length === 0) end = true;
    renderListData(listInfo);
    let container = document.getElementById('list-tweets');
    for(let i in listTweets) {
        let t = listTweets[i];
        await appendTweet(t, container);
    }
    return true;
}
async function renderListMembers(c) {
    let [listInfo, listMembers, settingsData] = await Promise.allSettled([
        API.getList(listId),
        API.getListMembers(listId, c),
        API.getSettings()
    ]).catch(e => {
        console.error(e);
    });
    if(listMembers.reason) {
        console.error(listTweets.reason);
        document.getElementById('loading-box-error').innerHTML = `List was not found.<br><a href="https://twitter.com/home">Go to homepage</a>`;
        return false;
    }
    listInfo = listInfo.value;
    listMembers = listMembers.value;
    settings = settingsData.value;
    cursor = listMembers.cursor;
    listMembers = listMembers.list;
    if(!cursor || listMembers.length === 0) end = true;
    renderListData(listInfo);
    let container = document.getElementById('list-members');
    for(let i in listMembers) {
        let t = listMembers[i];
        let followingElement = document.createElement('div');
        followingElement.classList.add('following-item');
        followingElement.innerHTML = `
        <div style="height:48px">
            <a href="https://twitter.com/${t.screen_name}" class="following-item-link">
                <img src="${t.profile_image_url_https}" alt="${t.screen_name}" class="following-item-avatar tweet-avatar" width="48" height="48">
                <div class="following-item-text">
                    <span class="tweet-header-name following-item-name">${escapeHTML(t.name)}</span><br>
                    <span class="tweet-header-handle">@${t.screen_name}</span>
                </div>
            </a>
        </div>
        <div>
            <button class="following-item-btn nice-button ${t.following ? 'following' : 'follow'}">${t.following ? 'Following' : 'Follow'}</button>
        </div>`;

        let followButton = followingElement.querySelector('.following-item-btn');
        followButton.addEventListener('click', async () => {
            if (followButton.classList.contains('following')) {
                await API.unfollowUser(t.screen_name);
                followButton.classList.remove('following');
                followButton.classList.add('follow');
                followButton.innerText = 'Follow';
            } else {
                await API.followUser(t.screen_name);
                followButton.classList.remove('follow');
                followButton.classList.add('following');
                followButton.innerText = 'Following';
            }
        });

        container.appendChild(followingElement);
    }
    return true;
}
async function renderListFollowers(c) {
    let [listInfo, listFollowers, settingsData] = await Promise.allSettled([
        API.getList(listId),
        API.getListFollowers(listId, c),
        API.getSettings()
    ]).catch(e => {
        console.error(e);
    });
    if(listFollowers.reason) {
        console.error(listTweets.reason);
        document.getElementById('loading-box-error').innerHTML = `List was not found.<br><a href="https://twitter.com/home">Go to homepage</a>`;
        return false;
    }
    listInfo = listInfo.value;
    listFollowers = listFollowers.value;
    settings = settingsData.value;
    cursor = listFollowers.cursor;
    listFollowers = listFollowers.list;
    if(!cursor || listFollowers.length === 0) end = true;
    renderListData(listInfo);
    let container = document.getElementById('list-followers');
    for(let i in listFollowers) {
        let t = listFollowers[i];
        let followingElement = document.createElement('div');
        followingElement.classList.add('following-item');
        followingElement.innerHTML = `
        <div style="height:48px">
            <a href="https://twitter.com/${t.screen_name}" class="following-item-link">
                <img src="${t.profile_image_url_https}" alt="${t.screen_name}" class="following-item-avatar tweet-avatar" width="48" height="48">
                <div class="following-item-text">
                    <span class="tweet-header-name following-item-name">${escapeHTML(t.name)}</span><br>
                    <span class="tweet-header-handle">@${t.screen_name}</span>
                </div>
            </a>
        </div>
        <div>
            <button class="following-item-btn nice-button ${t.following ? 'following' : 'follow'}">${t.following ? 'Following' : 'Follow'}</button>
        </div>`;

        let followButton = followingElement.querySelector('.following-item-btn');
        followButton.addEventListener('click', async () => {
            if (followButton.classList.contains('following')) {
                await API.unfollowUser(t.screen_name);
                followButton.classList.remove('following');
                followButton.classList.add('follow');
                followButton.innerText = 'Follow';
            } else {
                await API.followUser(t.screen_name);
                followButton.classList.remove('follow');
                followButton.classList.add('following');
                followButton.innerText = 'Following';
            }
        });

        container.appendChild(followingElement);
    }
    return true;
}

async function renderList() {
    if(subpage === 'tweets') {
        if(!await renderListTweets(cursor)) return;
    } else if(subpage === 'members') {
        if(!await renderListMembers(cursor)) return;
    } else if(subpage === 'followers') {
        if(!await renderListFollowers(cursor)) return;
    }
    document.getElementById('loading-box').hidden = true;
    return true;
}

let lastTweetDate = 0;
let activeTweet;
let loadingNewTweets = false;
let end = false;

setTimeout(() => {
    if(!document.getElementById('wtf-refresh')) {
        // weird bug
        location.reload();
    }
    document.getElementById('wtf-refresh').addEventListener('click', async () => {
        renderDiscovery(false);
    });
    window.addEventListener("popstate", async () => {
        cursor = undefined;
        updateSubpage();
        renderList();
    });
    document.addEventListener('scroll', async () => {
        // find active tweet by scroll amount
        if(Date.now() - lastTweetDate > 50) {
            lastTweetDate = Date.now();
            let tweets = Array.from(document.getElementsByClassName('tweet'));

            if(activeTweet) {
                activeTweet.classList.remove('tweet-active');
            }
            let scrollPoint = scrollY + innerHeight/2;
            activeTweet = tweets.find(t => scrollPoint > t.offsetTop && scrollPoint < t.offsetTop + t.offsetHeight);
            if(activeTweet) {
                activeTweet.classList.add('tweet-active');
            }
        }
        // loading new tweets
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !end) {
            if (loadingNewTweets) return;
            loadingNewTweets = true;
            await renderList();
            setTimeout(() => {
                loadingNewTweets = false;
            }, 250);
        }
    });
    
    // tweet hotkeys
    if(!vars.disableHotkeys) {
        let tle = document.getElementById('list-tweets');
        document.addEventListener('keydown', async e => {
            if(e.ctrlKey) return;
            // reply box
            if(e.target.className === 'tweet-reply-text') {
                if(e.altKey) {
                    if(e.keyCode === 82) { // ALT+R
                        // hide reply box
                        e.target.blur();
                        let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                        tweetReply.hidden = true;
                    } else if(e.keyCode === 77) { // ALT+M
                        // upload media
                        let tweetReplyUpload = activeTweet.getElementsByClassName('tweet-reply-upload')[0];
                        tweetReplyUpload.click();
                    } else if(e.keyCode === 70) { // ALT+F
                        // remove first media
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        let tweetReplyMediaElement = activeTweet.getElementsByClassName('tweet-reply-media')[0].children[0];
                        if(!tweetReplyMediaElement) return;
                        let removeBtn = tweetReplyMediaElement.getElementsByClassName('new-tweet-media-img-remove')[0];
                        removeBtn.click();
                    }
                }
            }
            if(e.target.className === 'tweet-quote-text') {
                if(e.altKey) {
                    if(e.keyCode === 81) { // ALT+Q
                        // hide quote box
                        e.target.blur();
                        let tweetReply = activeTweet.getElementsByClassName('tweet-quote')[0];
                        tweetReply.hidden = true;
                    } else if(e.keyCode === 77) { // ALT+M
                        // upload media
                        let tweetQuoteUpload = activeTweet.getElementsByClassName('tweet-quote-upload')[0];
                        tweetQuoteUpload.click();
                    } else if(e.keyCode === 70) { // ALT+F
                        // remove first media
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        let tweetQuoteMediaElement = activeTweet.getElementsByClassName('tweet-quote-media')[0].children[0];
                        if(!tweetQuoteMediaElement) return;
                        let removeBtn = tweetQuoteMediaElement.getElementsByClassName('new-tweet-media-img-remove')[0];
                        removeBtn.click();
                    }
                }
            }
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if(e.keyCode === 83) { // S
                // next tweet
                let index = [...tle.children].indexOf(activeTweet);
                if(index === -1) return;
                let nextTweet = tle.children[index + 1];
                if(!nextTweet) return;
                nextTweet.focus();
                nextTweet.scrollIntoView({ block: 'center' });
            } else if(e.keyCode === 87) { // W
                // previous tweet
                let index = [...tle.children].indexOf(activeTweet);
                if(index === -1) return;
                let nextTweet = tle.children[index - 1];
                if(!nextTweet) return;
                nextTweet.focus();
                nextTweet.scrollIntoView({ block: 'center' });
            } else if(e.keyCode === 76) { // L
                // like tweet
                if(!activeTweet) return;
                let tweetFavoriteButton = activeTweet.querySelector('.tweet-interact-favorite');
                tweetFavoriteButton.click();
            } else if(e.keyCode === 84) { // T
                // retweet
                if(!activeTweet) return;
                let tweetRetweetButton = activeTweet.querySelector('.tweet-interact-retweet-menu-retweet');
                tweetRetweetButton.click();
            } else if(e.keyCode === 82) { // R
                // open reply box
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                let tweetQuote = activeTweet.getElementsByClassName('tweet-quote')[0];
                let tweetReplyText = activeTweet.getElementsByClassName('tweet-reply-text')[0];
                
                tweetReply.hidden = false;
                tweetQuote.hidden = true;
                tweetReplyText.focus();
            } else if(e.keyCode === 81) { // Q
                // open quote box
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                let tweetQuote = activeTweet.getElementsByClassName('tweet-quote')[0];
                let tweetQuoteText = activeTweet.getElementsByClassName('tweet-quote-text')[0];
                
                tweetReply.hidden = true;
                tweetQuote.hidden = false;
                tweetQuoteText.focus();
            } else if(e.keyCode === 32) { // Space
                // toggle tweet media
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetMedia = activeTweet.getElementsByClassName('tweet-media')[0].children[0];
                if(!tweetMedia) return;
                if(tweetMedia.tagName === "VIDEO") {
                    tweetMedia.paused ? tweetMedia.play() : tweetMedia.pause();
                } else {
                    tweetMedia.click();
                    tweetMedia.click();
                }
            } else if(e.keyCode === 13) { // Enter
                // open tweet
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                activeTweet.click();
            } else if(e.keyCode === 67 && !e.ctrlKey && !e.altKey) { // C
                // copy image
                if(e.target.className.includes('tweet tweet-id-')) {
                    if(!activeTweet) return;
                    let media = activeTweet.getElementsByClassName('tweet-media')[0];
                    if(!media) return;
                    media = media.children[0];
                    if(!media) return;
                    if(media.tagName === "IMG") {
                        let img = media;
                        let canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        let ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, img.width, img.height);
                        canvas.toBlob((blob) => {
                            navigator.clipboard.write([
                                new ClipboardItem({ "image/png": blob })
                            ]);
                        }, "image/png");
                    }
                }
            } else if(e.keyCode === 68 && !e.ctrlKey && !e.altKey) { // D
                // download media
                if(e.target.className.includes('tweet tweet-id-')) {
                    activeTweet.getElementsByClassName('tweet-interact-more-menu-download')[0].click();
                }
            }
        });
    }
    document.addEventListener('clearActiveTweet', () => {
        if(activeTweet) {
            activeTweet.classList.remove('tweet-active');
        }
        activeTweet = undefined;
    });
    document.addEventListener('findActiveTweet', () => {
        let tweets = Array.from(document.getElementsByClassName('tweet'));
        if(activeTweet) {
            activeTweet.classList.remove('tweet-active');
        }
        let scrollPoint = scrollY + innerHeight/2;
        activeTweet = tweets.find(t => scrollPoint > t.offsetTop && scrollPoint < t.offsetTop + t.offsetHeight);
        if(activeTweet) {
            activeTweet.classList.add('tweet-active');
        }
    });

    document.getElementById('list-members-div').addEventListener('click', () => {
        document.getElementById('ns-members').click();
    });
    document.getElementById('list-followers-div').addEventListener('click', () => {
        document.getElementById('ns-followers').click();
    });

    let listSwitches = Array.from(document.getElementsByClassName('list-switch'));
    listSwitches.forEach(s => {
        s.addEventListener('click', async () => {
            let id = s.id.split('-')[1];
            switch(id) {
                case 'tweets': history.pushState({}, null, `/i/lists/${listId}`); break;
                case 'members': history.pushState({}, null, `/i/lists/${listId}/members`); break;
                case 'followers': history.pushState({}, null, `/i/lists/${listId}/followers`); break;
            }
            document.getElementById('loading-box').hidden = false;
            updateSubpage();
            cursor = undefined;
            renderList();
        });
    });
    // Update dates every minute
    setInterval(() => {
        let tweetDates = Array.from(document.getElementsByClassName('tweet-time'));
        let tweetQuoteDates = Array.from(document.getElementsByClassName('tweet-time-quote'));
        let all = [...tweetDates, ...tweetQuoteDates];
        all.forEach(date => {
            date.innerText = timeElapsed(+date.dataset.timestamp);
        });
    }, 60000);
    
    // custom events
    document.addEventListener('userRequest', () => {
        if(!user) return;
        let event = new CustomEvent('updateUserData', { detail: user });
        document.dispatchEvent(event);
    });
    // Run
    updateSubpage();
    updateUserData();
    renderDiscovery();
    renderList();
    setInterval(updateUserData, 60000 * 3);
    setInterval(() => renderDiscovery(false), 60000 * 5);
}, 250);