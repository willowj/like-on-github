/**
 * LikeOnGitHub
 *
 * This file is part of the LikeOnGitHub; an opensource Google Chrome extension
 * http://github.com/idnan/like-on-github
 *
 * MIT (c) Adnan Ahmed <mahradnan@hotmail.com>
 */

function getMouseSelectText  () {
    if (document.selection){
        return document.selection.createRange().text;
    }else{

    return window.getSelection().toString();
    }
    // body...
}
(function () {

    var Helper = {

        /**
         * Hides the log on github popup
         */
        closePopup: function () {

            let $container = $(Config.EX_COTAINER);

            if ($container.length === 0) {
                return false;
            }

            Helper.resetPopupHtml();


            $(Config.EX_COTAINER).hide();
            $(Config.EX_INPUT_TITLE).val('');
            $(Config.EX_INPUT_NOTE).val('');
            $(Config.EX_INPUT_URL).val('');
            $(Config.EX_INPUT_COMMENT).val('');

            return true;
        },

        /**
         * Gets the tab switcher element and makes it visible. If it cannot find the element creates it.
         */
        showPopup: function () {
            let $container = $(Config.EX_COTAINER);

            // Some pages remove the tab switcher HTML by chance
            // so we check if the tab switcher was found and we re append if it is not found
            if ($container.length === 0) {
                appendLikeOnGithubHtml(Config.EX_CONTAINER_BODY);
                $container = $(Config.EX_COTAINER);
            }

            $container.show();
        },

        /**
         * Reset the html of the popup
         */
        resetPopupHtml: function () {

            $(Config.EX_BTN_SAVE).text('Save');

            $(Config.EX_ERROR_CONTAINER).hide();
            $(Config.EX_ERROR_LINE).html('');
        },

        /**
         * Validate the form fields
         */
        isFormValid: function () {

            let title = $(Config.EX_INPUT_TITLE).val().trim(),
                comment = $(Config.EX_INPUT_COMMENT).val().trim();

            return !!(title && comment);
        },
    };

    var Storage = {

        /**
         * Get value from storage
         *
         * @returns {string}
         * @param callback
         */
        getRepoUrl: function (callback) {

            chrome.extension.sendMessage({
                type: 'getStorage',
                params: {
                    keys: ['owner', 'repo', 'path', 'token', 'committer_name', 'committer_email']
                }
            }, function (res) {
                callback(res);
            });
        },
    };

    /**
     * Configuration constants for the extension
     *
     * @type {Object}
     */
    var Config = {
        // Templates
        MAIN_TEMPLATE: '<div class="logh">' +
            '<h3>Like On GitHub</h3>' +
            '<div class="clogl">' +
            '<div class="lbllogh"><span class="reqlogh">*</span>Tag for the link</div>' +
            `<input list="tagOpt" name="tag">
            <datalist id="tagOpt">
                <option value="">None</option>
                <option value="to_read">to_read</option>
                <option value="collect">collect</option>
                <option value="tools">tools</option>
            </datalist>`  +
            '<div class="lbllogh"><span class="reqlogh">*</span>Title (label for the link)</div>' +
            '<input type="text" name="title">' +
            '<input type="hidden" name="cite">' +
            '<div class="lbllogh"><span class="reqlogh">*</span>Notes (Notes for the link)</div>' +
            '<textarea  name="note"> </textarea>' +

            '<div class="clogl">' +
            '<input type="hidden" name="url">' +
            '</div>' +

            '<div class="clogl">' +
            '<div class="lbllogh"><span class="reqlogh">*</span>Comment (commit message)</div>' +
            '<textarea name="comment"></textarea>' +
            '</div>' +
            '<div id="action-btns">' +
            '<div class="btn btn-primary" id="logh_btn_save">Save</div>' +
            '<div class="btn" id="logh_btn_cancel">Cancel</div>' +
            '</div>' +
            '<div class="elogh hlogh">' +
            '<p></p>' +
            '</div>' +
            '</div>',

        // References to DOM elements
        EX_COTAINER: '.logh',
        EX_INPUT_TITLE: '.logh input[name="title"]',
        EX_INPUT_NOTE: '.logh textarea[name="note"]',
        EX_INPUT_TAG: '.logh input[name="tag"]',
        EX_INPUT_CITE: '.logh input[name="cite"]',
        EX_INPUT_URL: '.logh input[name="url"]',
        EX_INPUT_COMMENT: '.logh textarea[name="comment"]',
        EX_CONTAINER_BODY: 'body',
        EX_BTN_SAVE: '.logh #logh_btn_save',
        EX_BTN_CANCEL: '.logh #logh_btn_cancel',
        EX_ERROR_CONTAINER: '.logh .elogh',
        EX_ERROR_LINE: '.logh .elogh p',

        // Shortcut for activation
        MASTER_KEY: '⌘+⇧+l, ⌃+⇧+l',

        // Key codes for certain actions
        ESCAPE_KEY: 27,
        ENTER_KEY: 13,

        // REPO
        BASE_URL: 'https://api.github.com/repos',
    };

    /**
     * Houses all the browser related actions
     *
     * @type {Object}
     */
    var ActiveTab = {

        activeTab: false,

        /**
         * Return current selected tab
         *
         * @returns {*}
         */
        get: function (callback) {

            let activeTab = ActiveTab.activeTab;

            if (activeTab) {
                callback(activeTab);
            }

            chrome.extension.sendMessage({type: 'getActiveTab'}, function (tab) {

                if (!tab) {
                    return false;
                }

                ActiveTab.activeTab = tab;

                callback(ActiveTab.activeTab);
            });
        }
    };

    var Repo = {

        commitLike: function (items) {

            let repoUrl = `${Config.BASE_URL}/${items['owner']}/${items['repo']}/contents/${items['path']}?access_token=${items['token']}`;

            if (!repoUrl) {
                return false;
            }

            let activeTabTitle = $(Config.EX_INPUT_TITLE).val(),
                activeNote = $(Config.EX_INPUT_NOTE).val(),
                activeTag = $(Config.EX_INPUT_TAG).val() || 'collect',
                activeCite = $(Config.EX_INPUT_CITE).val(),
                activeTabUrl = $(Config.EX_INPUT_URL).val(),
                commitMessage = $(Config.EX_INPUT_COMMENT).val();

            fetch(repoUrl)
                .then(response => response.json())
                .then(response => {

                    let sha = response.sha,
                        encodedContent = response.content,
                        decodedContent = decodeURIComponent(escape(window.atob(encodedContent)));

                    let tag = `<**${activeTag}**>`;
                    if (activeNote){
                        activeNote =`\n    - note: ` +
                            activeNote.split('\n').join('\n      > ');
                     }

                    if (activeCite){
                        activeCite ='\n    - > '+
                            activeCite.split('\n').join('\n      > ');
                     }
                    let date = (new Date()).toLocaleString().split(' ')[0]

                    const dataToAppend = `\n\n - ##### ${tag} [${activeTabTitle}](${activeTabUrl})    ${date} ${activeNote}${activeCite}\n\n`;

                    // append data in the front
                    decodedContent = Repo.appendDataBefore(dataToAppend, tag, decodedContent);

                    // decode content
                    encodedContent = window.btoa(unescape(encodeURIComponent(decodedContent)));

                    // prepare commit
                    return {
                        sha: sha,
                        content: encodedContent,
                        message: commitMessage,
                        committer: {
                            'name': items['committer_name'],
                            'email': items['committer_email']
                        }
                    }
                })
                .then(commit => fetch(repoUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(commit)
                }))
                .then(success => {

                    $(Config.EX_BTN_SAVE).text('Save');

                    success.json().then((res) => {

                        $(Config.EX_ERROR_CONTAINER).show();

                        let message = '';
                        if (success.status && success.status === 200) {
                            message = 'Link pushed: <a href="' + res.commit.html_url + '" target="_blank">Click</a> (Popup will auto close after 5 secs)';

                            // close the popup after 5 secs
                            setTimeout(function () {
                                Helper.closePopup();
                            }, 5000);
                        } else {
                            message = res.message;
                        }

                        $(Config.EX_ERROR_LINE).html(message);
                        $(Config.EX_BTN_SAVE).removeClass('saving');
                    });
                })
                .catch(error => {
                    $(Config.EX_BTN_SAVE).removeClass('saving').text('Save');
                });
        },

        /**
         * Append data in the front
         * @param dataToAppend
         * @param content
         * @returns {String}
         */
        appendDataBefore: function (dataToAppend,tag, content) {
            // If the file is empty
            tag = tag.toUpperCase()
            if (content.trim().length === 0) {
                content += '# today-i-liked \nContent that I liked. Saved using https://goo.gl/Wj595G \n';
            }
            const arr = content.split('### _');
            // if the length of arr is 1, then it is the first time to append data

            if (arr.length === 1) {
                arr[0] += '### _' + tag + '\n';//Repo.getDateHeader();
                arr[0] += dataToAppend;
                content = arr.join('');
            } else {
                var found = false;
                for (var i = arr.length - 1; i >= 0; i--) {
                    if (arr[i] .indexOf(tag + '\n')>-1) {
                        //  if already have same tag then append to that
                        arr[i] += dataToAppend;
                        found = true
                        break;
                    }
                }
                if (found == false){ // not found append to first part
                    arr[0] += '### _' + tag + '\n';
                    arr[0] += dataToAppend;
                }
                content = arr.join('### _');
            }
            return content;
        },

        /**
         * Return date header
         *
         * @returns {string}
         */
        getDateHeader: function () {
            return `\n### _ ${Repo.getCurrentDate()} \n`;
        },

        /**
         * Check if current date already exists in the content
         *
         * @param content
         * @returns {boolean}
         */
        isCurrentDateExists: function (content) {
            return (content.indexOf(Repo.getCurrentDate()) !== -1);
        },

        /**
         * Return current
         *
         * @returns {string}
         */
        getCurrentDate: function () {
            const date = new Date();
            return `${Repo.monthNames()[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        },

        /**
         * Return month names
         *
         * @returns {string[]}
         */
        monthNames: function () {
            return [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
        },
    };

    /**
     * Main extension class
     *
     * @returns {{loadExtension: loadExtension, bindUI: bindUI}}
     * @constructor
     */
    function LikeOnGithub() {

        /**
         * Appends the tab switcher HTML to the $container
         *
         * @param $container
         * @returns {*}
         */
        function appendLikeOnGithubHtml($container) {
            if (!($container instanceof jQuery)) {
                $container = $($container);
            }

            $container.append(Config.MAIN_TEMPLATE);
            return $container;
        }

        return {

            /**
             * Loads the extension in specified container
             *
             * @param $container
             */
            loadExtension: function ($container) {
                appendLikeOnGithubHtml($container);
                this.bindUI();
            },

            /**
             * Binds the UI elements for the extension
             */
            bindUI: function () {

                // close on escape key
                $(document).on('keyup', function (e) {
                    if (e.keyCode === Config.ESCAPE_KEY) {
                        Helper.closePopup();
                    }
                });
                $(document).on('keyup', function (e) {
                    if ($(Config.EX_COTAINER).css('display')=='none') return;

                    if (e.keyCode === Config.ENTER_KEY) {
                       $(Config.EX_BTN_SAVE).click();
                    }
                });
                // if clicked outside the popup
                $(document).on('mouseup', function (e) {

                    let container = $(Config.EX_COTAINER);
                    if (container.css('display')=='none') return;
                    if (!container.is(e.target) && container.has(e.target).length === 0) {
                        Helper.closePopup();
                    }
                });

                // hide the switcher on blurring of input
                $(document).on('click', Config.EX_BTN_CANCEL, function () {
                    Helper.closePopup();
                });

                // hide the switcher on blurring of input
                $(document).on('click', Config.EX_BTN_SAVE, function () {

                    let saveBtn = $(Config.EX_BTN_SAVE);

                    if (saveBtn.hasClass('saving') || !Helper.isFormValid()) {
                        return false;
                    }

                    Helper.resetPopupHtml();

                    saveBtn.addClass('saving').text('Saving...');

                    Storage.getRepoUrl(function (items) {

                        // commit the like
                        if (items) {
                            Repo.commitLike(items);
                        }
                    });
                });

                // master key binding for which extension will be enabled
                key(Config.MASTER_KEY, function () {
                    let MouseSelText = getMouseSelectText();
                    //console.log(MouseSelText);
                    Helper.showPopup();
                    // get the active tab
                    $(Config.EX_INPUT_NOTE).focus(); //after eval mouse select
                    ActiveTab.get(function (activeTab) {

                        if (!activeTab) {
                            return false;
                        }

                        //console.log('MouseSelText',MouseSelText,getMouseSelectText())
                        $(Config.EX_INPUT_TITLE).val(activeTab.title);
                        $(Config.EX_INPUT_CITE).val(MouseSelText);
                        $(Config.EX_INPUT_URL).val(activeTab.url);
                        $(Config.EX_INPUT_COMMENT).val('New Link: ' + activeTab.title);
                    });


                });
            }
        };
    }

    $(document).ready(function () {
        var likeOnGithub = new LikeOnGithub();
        likeOnGithub.loadExtension(Config.EX_CONTAINER_BODY);
    });

})();
