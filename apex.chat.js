/**
 *
 * Plugin : Apex chat
 * Version: 1.0.0
 *
 * Author : isabolic99
 * Mail   : sabolic.ivan@gmail.com
 * Twitter: @isabolic99
 */

// namespace
(function(){
   if(window.apex.plugins === undefined){
      window.apex.plugins = {};
   }
}());


(function($, x) {

    /**
     * [anonymous_user constants]
     * @type {String}
     */
    var anonymous_user = ["ANONYMOUS", "NOBODY"];

    var lang = {
        chatname            : apex.lang.getMessage("AXCHAT.LOGIN.CHATNAME.PROMPT") || "chatname?",
        textareaPlaceholder : apex.lang.getMessage("AXCHAT.TEXTAREA.MSG.PHOLDER")  || "Text something",
        btnLabel            : apex.lang.getMessage("AXCHAT.BUTTON.LABEL")          || "Invite link",
        linkDlgtitle        : apex.lang.getMessage("AXCHAT.DIALOG.TITLE")          || "Invite link",
        notUserJoin         : apex.lang.getMessage("AXCHAT.USER.JOIN")             || "has joined your channel...",
        notUserLeft         : apex.lang.getMessage("AXCHAT.USER.LEFT")             || "has left your channel..."
    }

    var options = {
        socketServer         : null,
        apxRegionId          : null,
        currentUser          : null,
        room                 : null,
        apxChatRoomUrl       : null,
        apxRoomItemVal       : null,
        ajaxIdentifier       : null,
        showLeftNotefication : true,
        showJoinNotefication : true,
        htmlTemplate         : {
            chatThreadContainer : "<div class='ch-thread-cont' style='display:none'>"                                                     +
                                            "</div>",
            chatRow             : "<div class='ch-row'>"                                                                                  +
                                                "<div class='ch-avatar'>#AVATAR#</div>"                                                   +
                                                "<div class='ch-username'>#USERNAME#</div>"                                               +
                                                "<div class='ch-msg #CURRENT_USR#'>#MSG#</div>"                                           +
                                            "</div>",
            typingInfo          : "<div class='ch-ty-row ty-#USR#'>"                                                                      +
                                                "<div class='ch-type'>#MSG#</div>"                                                        +
                                            "</div>",
            userLeftNot         : "<div class='ch-user-left-row ty-#USR#'>"                                                               +
                                                "<div class='ch-left'>#MSG#</div>"                                                        +
                                            "</div>",
            userJoinNot         : "<div class='ch-user-join-row ty-#USR#'>"                                                               +
                                                "<div class='ch-join'>#MSG#</div>"                                                        +
                                            "</div>",
            loginOverlay        : "<div class='ch ch-login'>"                                                                             +
                                                "<div class='form'>"                                                                      +
                                                    "<h3 class='title'>chatname?</h3>"                                                    +
                                                    "<input class='username' type='text' />"                                              +
                                                "</div>"                                                                                  +
                                            "</div>",
            chatInput           : "<div class='ch-input-cont'>"                                                                           +
                                                "<textarea class='ch-input' placeholder='text something'></textarea>"                     +
                                            "<div>",
            buttonTemplate      : "<button class='t-Button t-Button--icon t-Button--iconLeft t-Button--hot btn-invite' type='button'>"    +
                                                "<span class='t-Icon t-Icon--left fa fa-link' aria-hidden='true'></span>"                 +
                                                "<span class='t-Button-label'>Invite Link</span>"                                         +
                                                "<span class='t-Icon t-Icon--right fa fa-link' aria-hidden='true'></span>"                +
                                            "</button>",
            linkDialog          : "<div class='invite-dialog' style='display:none' title='Invite link'>"                                  +
                                                "<input type='text' value='#LINK#'></input>"                                              +
                                            "</div>"
        }
    };

    /**
     * [xDebug - PRIVATE function for debug]
     * @param  string   functionName  caller function
     * @param  array    params        caller arguments
     */
    var xDebug = function xDebug(functionName, params){
        x.debug(this.jsName || " - " || functionName, params, this);
    };

    /**
     * [triggerEvent     - PRIVATE handler fn - trigger apex events]
     * @param String evt - apex event name to trigger
     */
    var triggerEvent = function triggerEvent(evt, evtData) {
        xDebug.call(this, arguments.callee.name, arguments);
        this.options.$itemId.trigger(evt, [evtData]);
        $(this).trigger(evt + "." + this.apexname, [evtData]);
    };

     /**
     * [intervalFlag call passed function repeatedly "fnIntervat", stop only when flagForClear is set to true ]
     * @param  {[type]} fnIntervat   [function for repeatedly call]
     * @param  {[type]} flagForClear [key prop. on this scope]
     * @param  {[type]} timer        [timer, def. 200]
     */
    var intervalFlag = function  intervalFlag(fnIntervat, flagForClear, timer){
      var interval;

      xDebug.call(this, arguments.callee.name, arguments);

      this[flagForClear] = false;

      interval = setInterval(function(){
                    fnIntervat.call(this);

                    if (this[flagForClear]){
                      clearInterval(interval);
                    }
                  }.bind(this), (timer || 200));
    };

    // deprecated - TODO remove
    var hashCode = function hashCode(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
           hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    };

    // deprecated - TODO remove
    var intToRGB = function intToRGB(i){
        var c = (i & 0x00FFFFFF)
            .toString(16)
            .toUpperCase();

        return "00000".substring(0, 6 - c.length) + c;
    }

    var setChatContHeight = function setChatContHeight(){
        var el = this.container
                     .find(".ch-thread-cont")
            topParent = this.parent.parent();

        xDebug.call(this, arguments.callee.name, arguments);

        if (el.is(":visible") === true) {
            if(topParent.hasClass("t-Body-actionsContent") === true){
                height =    topParent.height()                                      -
                            this.parent.find(".t-Region-header").outerHeight(true)  -
                            this.container.find(".ch-input-cont").outerHeight(true);

                el.height(height);
            }else{
                el.height(this.parent.find(".t-Region-body").height() - this.container.find(".ch-input-cont").outerHeight(true));
            }
            this.isRendered = true;
        }
    };

    var addMessageElement = function addMessageElement (msg, user){
        var rowtemplate = this.options.htmlTemplate.chatRow,
            userName    =  user || this.options.currentUser;

        rowtemplate = rowtemplate.replace("#MSG#"     , msg                                  );
        rowtemplate = rowtemplate.replace("#AVATAR#"  , userName.substring(0,2).toUpperCase());
        rowtemplate = rowtemplate.replace("#USERNAME#", userName                             );

        if (this.options.currentUser === userName) {
            rowtemplate = rowtemplate.replace("#CURRENT_USR#" , "current-usr");
        } else {
            rowtemplate = rowtemplate.replace("#CURRENT_USR#" , "");
        }

        rowtemplate = $(rowtemplate);

        this.container.find(".ch-thread-cont").append(rowtemplate);

        // scroll to bottom
        this.container
            .find(".ch-thread-cont")
            .scrollTop(
                this.container
                    .find(".ch-thread-cont")
                    .get(0)
                    .scrollHeight
                );
    };

    var rmSimpleLogin = function rmSimpleLogin(){
        this.container.find(".ch-login").remove();
        this.container.find(".ch-input-cont").show();
        this.container.find(".ch-thread-cont").show();
    };

    var typeInfo = function typeInfo(msg, user, action, delayRemove){
            var rowtemplate = this.options.htmlTemplate.typingInfo,
                userName    =  user || this.options.currentUser;

        if(action === "show"){
            rowtemplate = rowtemplate.replace("#MSG#", user + " " + msg);
            rowtemplate = rowtemplate.replace("#USR#", user);
            this.container.find(".ch-ty-row.ty-" + user).remove();
            this.container.find(".ch-thread-cont").append(rowtemplate);
        }else{
            this.container.find(".ch-ty-row.ty-" + user).delay(delayRemove).remove();
        }
    };

    var userLeftJoin = function userLeftJoin(msg, user, type){
        var rowtemplate,
            userName    =  user || this.options.currentUser;

        if (this.options.showLeftNotefication === true && type === "LEFT"){
            rowtemplate = this.options.htmlTemplate.userLeftNot;
        }
        if (this.options.showJoinNotefication === true && type === "JOIN"){
            rowtemplate = this.options.htmlTemplate.userJoinNot;
        }

        if (rowtemplate !== undefined){
            rowtemplate = rowtemplate.replace("#MSG#", user + " " + msg);
            rowtemplate = rowtemplate.replace("#USR#", user);
            this.container.find(".ch-thread-cont").append(rowtemplate);
        }
    };

    var setEvents = function setEvents(){
        var typingTimer,
            typingInterval = 500,
            typingTimeOut = function(){
                                this.socket.emit("STOP.TYPING");
                                typeInfo.call(this, "", null, "hide", 0);
                            }.bind(this);

        xDebug.call(this, arguments.callee.name, arguments);

        this.container.on("keydown", ".ch-input", function(e){
            var msg;
            if (e.keyCode === 13) {
                msg = $(e.currentTarget).val();
                $(e.currentTarget).val("");
                addMessageElement.call(this, msg);
                this.socket.emit("NEW.MESSAGE", msg);
                this.socket.emit("STOP.TYPING");
                typeInfo.call(this, "", null, "hide", 0);

                return false;

            }else if(e.keyCode === 9){
                this.socket.emit("STOP.TYPING");
            }else{
                this.socket.emit("TYPING");
                clearTimeout(typingTimer);
                typingTimer = setTimeout(typingTimeOut, typingInterval);
            }
        }.bind(this));

        this.container.on("keydown", ".username", function(e){
            var username = $(e.target).val();
            if (e.keyCode === 13) {
                if (username !== ""){
                    this.options.currentUser = username;
                    this.socket.emit("SET.ROOM", {room : this.options.room, username:this.options.currentUser});
                    rmSimpleLogin.call(this);
                    setApxItemVal.call(this, this.options.room);

                    if (this.parent.hasClass("right-col") === true) {
                        intervalFlag.call(this, setChatContHeight, "isRendered");
                    }
                }

                e.preventDefault();
                return false;
            }
        }.bind(this));

        this.parent.on("click", ".btn-invite", function(e){
            this.linkDialog.dialog({width:500, height:90}).show();
            e.preventDefault();
            return false;
        }.bind(this));

        if (this.parent.hasClass("right-col") === true) {
            // reg. resize event
            $(window).resize(function(){
                intervalFlag.call(
                    this, setChatContHeight, "isRendered", 500
                );
            }.bind(this));
        }
    };

    var setApxItemVal = function setApxItemVal(val){
        var params;

        xDebug.call(this, arguments.callee.name, arguments);

        params = {
            p_flow_id      : $('#pFlowId').val(),
            p_flow_step_id : $('#pFlowStepId').val(),
            p_instance     : $('#pInstance').val(),
            p_debug        : $('#pdebug').val(),
            x01            : val,
            p_request      : 'PLUGIN=' + this.options.ajaxIdentifier
        };

        $.ajax({
                type     : 'POST',
                url      : 'wwv_flow.show',
                data     : params,
                dateType : 'application/json',
                async    : true
            }).done(function(data){
                xDebug.call(this, arguments.callee.name, arguments);
              }.bind(this))
               .fail(function(data) {
                alert( "error : " || data );
              }.bind(this));
    }

    var setSocketEvents = function setSocketEvents() {
        xDebug.call(this, arguments.callee.name, arguments);

        this.socket.on("ROOM.NAME", function (room) {
            xDebug.call(this, arguments.callee.name, arguments);

            if (this.options.room === null){
                this.options.room = room;
                this.options.apxChatRoomUrl = this.options.apxChatRoomUrl.replace("#roomid#", room);
                setInviteButton.call(this);
                setApxItemVal.call(this, room);
            }

        }.bind(this));

        this.socket.on("NEW.MESSAGE", function (data) {
            if (this.options.currentUser !== null) {
                typeInfo.call(this, "", data.username, "hide", 0);
                addMessageElement.call(this, data.message, data.username);
            }
        }.bind(this));

        this.socket.on("TYPING", function (data) {
            if (this.options.currentUser !== null) {
                typeInfo.call(this, "is typing..", data.username, "show");
            }
        }.bind(this));

        this.socket.on("STOP.TYPING", function (data) {
            if (this.options.currentUser !== null) {
                typeInfo.call(this, "", data.username, "hide", 0);
            }
        }.bind(this));

        this.socket.on("USER.JOINED", function (data){
            if (this.options.currentUser !== null) {
                userLeftJoin.call(this, "has joined your channel...", data.username, "JOIN", 0);
            }
        }.bind(this));

        this.socket.on("USER.LEFT", function (data){
            if (this.options.currentUser !== null) {
                typeInfo.call(this, "", data.username, "hide", 0);
                userLeftJoin.call(this, "has left your channel...", data.username, "LEFT", 0);
            }
        }.bind(this));

        if ( this.options.room        !== null ){
            this.options.apxChatRoomUrl = this.options.apxChatRoomUrl.replace("#roomid#", this.options.room);
            setInviteButton.call(this);
            setApxItemVal.call(this, this.options.room);

            if (this.options.currentUser !== null) {
                this.socket.emit("SET.ROOM", {room : this.options.room, username:this.options.currentUser});
            }
        }
    };

    var setDom = function setDom(){
        xDebug.call(this, arguments.callee.name, arguments);

        this.container.append(this.options.htmlTemplate.chatThreadContainer);
        this.container.append(this.options.htmlTemplate.chatInput);

        if (this.options.currentUser === null ||
            anonymous_user.indexOf(this.options.currentUser.toUpperCase()) > -1) {
            this.container.append(this.options.htmlTemplate.loginOverlay);
            this.container.find(".ch-input-cont").hide();
            this.options.currentUser = null;
        }else{
            rmSimpleLogin.call(this);
        }

        if (this.parent.hasClass("right-col") === true) {
            intervalFlag.call(this, setChatContHeight, "isRendered");
        }

        setEvents.call(this);
        setSocketEvents.call(this);

    };

    var setInviteButton = function setInviteButton(){
        var buttonTemplate = this.options.htmlTemplate.buttonTemplate,
            dlgTemplate    = this.options.htmlTemplate.linkDialog,
            dlgTemplate    = dlgTemplate.replace("#LINK#", this.options.apxChatRoomUrl);

        if (this.options.room !== null){
            this.parent.find(".t-Region-headerItems--buttons").prepend(buttonTemplate);
        }
        this.linkDialog = $(dlgTemplate);
        $("body").append(dlgTemplate);
    }

    apex.plugins.apexChat = function(opts) {
        this.apexname = "APEX_CHAT";
        this.jsName = "apex.plugins.apexChat";
        this.container = $("<div>",{"class" :"apx-chat-reg"});
        this.options = {};
        this.parent = null;
        this.linkDialog = null;
        this.isRendered = false;
        this.init  = function(){

            if (window.io === undefined || $.isFunction(io.Socket) === false) {
                throw this.jsName || ": requires socket.io (https://github.com/socketio/socket.io)";
            }

            if (window.Handlebars === undefined) {
                throw this.jsName || ": requires handlebars.js (http://handlebarsjs.com/)";
            }

            if ($.type(opts) ===  "string") {
                opts = JSON.parse(opts);
            }

            if ($.isPlainObject(opts)) {
                this.options = $.extend(true, {}, this.options, options, opts);
            } else {
                throw this.jsName || ": Invalid options passed.";
            }

            this.socket = io(this.options.socketServer);
            this.parent = $(this.options.apxRegionId);

            if (this.parent.find(".t-Region-body").length > 0) {
                this.parent.find(".t-Region-body").append(this.container);
            } else {
                this.parent.append(this.container);
            }

            setDom.call(this);

            return this;
        };

        return this.init();
    }

    apex.plugins.apexChat.prototype = {};

})(apex.jQuery, apex);
