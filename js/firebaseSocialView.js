define([
	'core/js/adapt',
	'core/js/views/componentView'
], function(Adapt, ComponentView) {
    
    var FirebaseSocialView = ComponentView.extend({

		isFirebaseEnabled: false,
        logEnabled: false,
        databaseRef: "",
		dataTableName: "",
		dataTableCount: 0,
        pointsData: [],

		events: {
			'click button': 'pushComment',
			'click .delete': 'deleteComment',
			'click .upvote, .downvote': 'vote',
			'click .sortTime': 'sortByTime',
			'click .sortVotes': 'sortByVotes',
			'click .showReplies': 'toggleComments',
			'click .toggleReply': 'toggleReply'
		},

        onFirebaseError: function()
		{
			var msg = "Firebase Extension is not enabled. Please add '_firebase._isEnabled' to course.json";

			try {
				throw new Error(msg);
			} catch(e) {
				console.error(e.name, e.message);
			}
		},

        initialize: function(){

            this.isFirebaseEnabled = (Adapt.firebase !== undefined);

            // TODO: Leaderboards?
            this.pointsData = [];

            if (this.logEnabled)
            	console.log("SocialDiscussion.initialize().fb:", this.isFirebaseEnabled);

            if (this.isFirebaseEnabled )
            {
                this.validateFirebaseIDs();

                // check if user signed in
                if (Adapt.firebase != null && Adapt.firebase.user != null)
                    this.onFirebaseSignedIn({ success: true, user: Adapt.firebase.user });
                else
                {
                    // wait for firebase ext to sign in user
                    this.listenTo(Adapt, { 'firebase:signedin': this.onFirebaseSignedIn });
                }

                // set on sign out listener
                this.listenTo(Adapt, { 'firebase:signedout': this.onFirebaseSignedOut });

            }
            else console.warn("Firebase Extension is not enabled.");

			ComponentView.prototype.initialize.apply(this, arguments);
        },

		postRender: function() {
            if (this.logEnabled) console.log("SocialDiscussion.postRender().fb:", this.isFirebaseEnabled);
		},

		remove: function() {

            if (this.logEnabled) console.log("SocialDiscussion.remove().fb:", this.isFirebaseEnabled);

            this.removeOnValueChange();

            this.databaseRef = null;

            this.stopListening(Adapt, 'firebase:signedin');
            this.stopListening(Adapt, 'firebase:signedout');

            ComponentView.prototype.remove.apply(this, arguments);
		},

        onFirebaseSignedIn: function(result) {

            if (this.logEnabled) console.log("SocialDiscussion.onFirebaseSignedIn.success:", result.success);

            this.stopListening(Adapt, 'firebase:signedin');

            if (result.success)
			{
                var parent = this;

                this.databaseRef = Adapt.firebase.database.ref(this.dataTableName);
                this.databaseRef.once("value")
                    .then(function(snapshot) {
                        //if (parent.logEnabled)
                        if (this.logEnabled) console.log("getTotalCount.numChildren:", snapshot.numChildren());
                        parent.dataTableCount = snapshot.numChildren();
                        parent.onFirebaseSignedInComplete();
                    });


			}
			else	// error sign in
			{
                console.error(result.error);

				this.onFirebaseError();
                this.setReadyStatus();
                this.setCompletionStatus();
            }
       	},

        onFirebaseSignedInComplete: function() {

            if (this.logEnabled) console.log("SocialDiscussion.onFirebaseSignedInComplete");
            this.onAddedItem();
            this.setReadyStatus();
            this.setCompletionStatus();

            // if not comments
            if (this.dataTableCount == 0)
            {
                this.showNoResults();
            }
        },

        onFirebaseSignedOut: function() {

            if (this.logEnabled) console.log("SocialDiscussion.onFirebaseSignedOut");

            // this will detect if user has signed out via SignIn Component
            // We will wait for user to sign back in either authentic or anonymous
            this.listenTo(Adapt, { 'firebase:signedin': this.onFirebaseSignedIn });
        },

        // This is where any added items will be triggered
        onAddedItem: function() {

            this.databaseRef.off('child_added', this.onValueChange);

            var parent = this;
            var count = 0;
            this.onValueChange = this.databaseRef.on('child_added', function(snapshot)
            {
                if (parent.logEnabled) console.log("onAddedItem check_count:" + count);
                if (snapshot.exists())
                {
                    var id = snapshot.key;
                    var comment = snapshot.val();
                    count++;

                    parent.displayComment(id, comment);

                    /* TODO: Leaderboards?
                    var points = comment.upvotes + comment.children;
                    parent.pointsData.push({
                        id: id,
                        points: points,
                        organization: comment.organization,
                        location: comment.location
                    });*/
                }
            });
        },

		validateFirebaseIDs: function() {

            if (this.logEnabled) {
                console.log("SocialDiscussion.validateFirebaseIDs()._firebaseID:", this.model.get('_firebaseID'));
                console.log("_firebaseID:", this.model.get('_firebaseID'), " | ", this.model.get('_firebaseSubID'));
			}

            if (this.model.get('_firebaseID') === undefined)
            {
                console.error("_firebaseID does not exist, please check components.json config settings.");
                return false;
            }
            if (this.model.get('_firebaseSubID') === undefined)
            {
                console.error("_firebaseID does not exist, please check components.json config settings.");
                return false;
            }

            // set db table name
            this.dataTableName = this.model.get('_firebaseID') + "/" + this.model.get('_firebaseSubID');

            return true;
		},

		findParent: function(parentId)
		{
			return this.$el.find('#comments').find('[data-id="' + parentId + '"] > ul');
		},

        getUserDisplayName: function()
        {
            // check if anonymous user
		    return ( Adapt.firebase.user.isAnonymous ) ? "Anonymous" : Adapt.firebase.user.displayName;
        },

        // Add New Comment
		pushComment: function(ev)
		{
		    var name = this.getUserDisplayName();
		    var userid = Adapt.firebase.user.uid;
			var location = Adapt.firebase.userLocation;
			var org = Adapt.firebase.userOrganization;
			var time = this.timeStamp();
			var $input = $(ev.currentTarget).prev('input');
			var comment = $input.val();

            // check if we have an empty field
			if (comment.length == 0)
			{
                $input.addClass('error');
       			return;
			}

			var parent = $input.closest('[data-id]').attr('data-id') || null;
			var childposts = $input.closest('[data-id]').find('span.toggle:first')
				.text() || null;

			var childcount = parseInt(childposts, 10) + 1 || null;

			// if we are the parent, do not add parent prop
			if (parent && parent.indexOf(this.model.get('_id')) >= 0) parent = null;

			if (comment)
			{
			    // add comment, triggers onAddedItem()
                this.databaseRef.push({
					uid: userid,
					name: name,
					comment: comment,
					time: time,
					upvotes: 0,
					children: 0,
					parent: parent,
					location: location,
                    org: org
				});

                // if its a child of parent, add child count
				if (parent)
				{
                    this.databaseRef.child(parent).update({
						children: childcount
					});
				}

			    this.dataTableCount++;

				this.hideNoResults();
			}

			// clear and hide input field
			$input.val('');
			var parentSubComments = $input.parent();

			// close sub comments
            if ($(parentSubComments).attr('class') == "subComments")
            {
                $(parentSubComments).slideToggle();
            }

            return false;
		},

		deleteComment: function(ev)
		{
            var id = $(ev.currentTarget).closest('li').data('id');
            this.databaseRef.child(id).remove();
            this.$el.find(ev.currentTarget).closest('li').hide();
		},

		vote: function(ev)
		{
            var id = $(ev.currentTarget).data('id');
	        var userid = Adapt.firebase.user.uid;

            var upvotesRef = this.databaseRef.child(id + '/upvotes');
            var upvotesMod = this.databaseRef.child(id + '/upvotesMod/');
            upvotesMod.once('value', function(snapshot)
			{
                upvotesMod.child(userid).set({ userid: userid });

                var voteSnapshot = snapshot.child(userid).val();
                var votes = document.getElementById(id).innerHTML;
                if (voteSnapshot === 1)
                {
                    votes--;

                    upvotesMod.child(userid).transaction(function(current)
					{
                        return 0;
                    });

                    this.$(ev.currentTarget).closest('div.upvote')
                        .removeClass('active');

                    upvotesRef.transaction(function(currentRank)
					{
                        return (currentRank || 0) - 1;
                    });
                }
                else
                {
                    votes++;
                    upvotesMod.child(userid).transaction(function(current)
					{
                        return 1;
                    });

                    this.$(ev.currentTarget).closest('div.upvote')
                        .addClass('active');

                    upvotesRef.transaction(function(currentRank)
					{
                        return (currentRank || 0) + 1;
                    });
                }

                document.getElementById(id).innerHTML = votes;
            });
		},

		toggleComments: function(event)
		{
			if (event.target && $(event.target).hasClass('showReplies'))
			{
			    var form = $(event.target).siblings('ul');

                // update button
			    var subCommentButton = $(event.currentTarget);
                if (subCommentButton.hasClass("is-open"))
                {
                    subCommentButton.removeClass('is-open');
                }
                else
                {
                    subCommentButton.addClass('is-open');
                }

               if ($(form).css("display") == 'none')
                {
                    $(event.currentTarget).siblings('ul').slideToggle();
                }
				else
                {
                    $(event.currentTarget).siblings('ul').slideToggle();
                }
			}
		},

		toggleReply: function(event)
		{
			if (event.target && event.target.className == 'toggleReply')
			{
                var parent = $(event.target).parent();
        		var next = event.target.nextElementSibling;
				if ($(next).css('display') == 'none')
				{
        	        // slides down the reply input form
                    $(this.$el.find('form.subComments')).slideUp(150);
                    $(event.currentTarget).siblings('form').slideDown(150);

                    // set focus on input field
                    if (Adapt.device.touch)
                        $(event.currentTarget).siblings('form').children('input');
                    else
                        $(event.currentTarget).siblings('form').children('input').focus();
				}
				else
				{
        			$(event.currentTarget).siblings('form').slideToggle();
				}
			}
		},

       timeStamp: function()
		{
			var now = new Date();
			var date = [
				now.getMonth() + 1,
				now.getDate(),
				now.getFullYear() - 2000
			];

			var time = [now.getHours(), now.getMinutes()];
			var suffix = time[0] < 12 ? 'AM' : 'PM';
			time[0] = time[0] < 12 ? time[0] : time[0] - 12;
			time[0] = time[0] || 12;

			for (var i = 1; i < 3; i++)
			{
				if (time[i] < 10) time[i] = '0' + time[i];
			}

			return date.join('/') + ' ' + time.join(':') + ' ' + suffix;
		},

		sortUsingNestedText: function(parent, childSelector, keySelector)
		{
			var items = parent.children(childSelector).sort(function(b, a)
			{
				var vA = this.$(keySelector, a).text();
				var vB = this.$(keySelector, b).text();
				return vA < vB ? -1 : vA > vB ? 1 : 0;
			});

			parent.append(items);
		},

        onValueChange: null,
		removeOnValueChange: function() {
            this.databaseRef.off('child_added', this.onValueChange);
            this.onValueChange = null;
		},

        sortByTime: function()
		{
            if (this.logEnabled) console.log("SocialDiscussion.sortByTime");

			$('.sortVotes').removeClass('btnSort-active');
			$('.sortTime').addClass('btnSort-active');
			$("#comments[data-id='" + this.model.get('_id') + "']").empty();

          	var parent = this;
			if (this.dataTableCount == 0)
			{
				this.showNoResults();
			}
			else
			{
				this.hideNoResults();

                this.databaseRef.once('value', function(snapshot)
                {
                    var count = 0;
                    snapshot.forEach(function(childSnapshot) {
                        var id = childSnapshot.key;
                        var comment = childSnapshot.val();
                        count++;
                        parent.displayComment(id, comment);
                    });
                });
			}
		},

        displayComment: function(id, comment)
        {
            var $parent = comment.parent ?
                this.findParent(comment.parent) :
                this.$el.find("#comments[data-id='" + this.model.get('_id') + "']");


            var num = this.$el.find("#comments li[data-id=" + id + "]").length;

            if (this.$el.find("#comments li[data-id=" + id + "]").length > 0) return;

            var $el = this.addComment(id, comment);

            $el.attr('data-id', id);
            $el.hide();
            $parent.prepend($el);
            $el.fadeIn('slow');

            // tag item to parent
            !comment.parent && $el.addClass('parent');

            this.$el.find("#comments[data-id='" + this.model.get('_id') + "']")
                .find('.sub-comments')
                .each(function()
                {
                    var count = $(this).children('li').length;
                    var commentText = (count > 1) ? " comments" : " comment";

                    if (count > 0) {
                        $(this).addClass('is-open');
                    }

                    // update child comment count
                    $(this).parent('li').find('.toggle.reply-count')
                        .html($(this).children('li').length + commentText);

                    // comments button
                    $(this)
                        .parent('li')
                        .find('.toggle.reply-button')
                        .find('.show-replies')
                        .html('Comments');
                });
        },

        addComment: function(id, comment)
        {
            if (this.logEnabled)
                console.log("Social.addComment: ", comment);

            var userid = comment.uid;
            var username = comment.name;

            // track user votes
            var upVotesMod = this.databaseRef.child(id).child('upvotesMod');

            // clone template
            var post = this.$el.find('#commentTemplate')
                .clone()
                .attr('id', null)
                .find('span.user-username')
                .text(comment.uid)
                .end();

            var justDate = comment.time.substr(0, comment.time.indexOf(' '));
            var justTime = comment.time.substr(comment.time.indexOf(' ') + 1);

            if (comment.name === this.model.get('hostName'))
            {
                post.find('span.user-username')
                    .addClass(
                        'orange-background white-text-color bold rounded px2'
                    );
            }

            if (comment.name === this.model.get('hostName2'))
            {
                post.find('span.user-username')
                    .addClass('green-background white-text-color bold px2');
            }

            if (comment.parent)
            {
                post.find('.sub-comments').hide();
            }

            // check if we are the admin or moderator
            // remove the Delete button
            if (Adapt.firebase.user.uid !== 'admin')
            {
                post.find('.delete').remove();
            }

            post.find('span.user-votes').attr('id', id);
            post.find('span.user-votes').text(comment.upvotes);
            post.find('span.user-location').text(comment.location);
            post.find('div.upvote').attr('data-id', id);
            post.find('div.downvote').attr('data-id', id);
            post.find('span.user-date').text(justDate);
            post.find('span.user-time').text(justTime);
            post.find('span.user-name > .username-text').text(username);
            post.find('p.user-comment').text(comment.comment);

            if (upVotesMod)
            {
                // check if active user has voted by userid
                upVotesMod.once('value', function(snapshot)
                {
                    var voteSnapshot = snapshot.child(userid).val();
                    if (voteSnapshot === 1)
                    {
                        post.find('div.upvote').addClass('active');
                    }
                });
            }

            return post;
        },

        showNoResults: function() {
            var noItems = this.$('.no-items-found');
            if (noItems.hasClass('hidden')) noItems.removeClass('hidden');

            var sortTime = this.$('.sortTime');
            if (!sortTime.hasClass('hidden')) sortTime.addClass('hidden');

            var sortVotes = this.$('.sortVotes');
            if (!sortVotes.hasClass('hidden')) sortVotes.addClass('hidden');

            var commentsDiv = this.$('#comments');
            if (!commentsDiv.hasClass('hidden')) commentsDiv.addClass('hidden');
		},

        hideNoResults: function() {
            var noItems = this.$('.no-items-found');
            if (!noItems.hasClass('hidden')) noItems.addClass('hidden');

            var sortTime = this.$('.sortTime');
            if (sortTime.hasClass('hidden')) sortTime.removeClass('hidden');

            var sortVotes = this.$('.sortVotes');
            if (sortVotes.hasClass('hidden')) sortVotes.removeClass('hidden');

            var commentsDiv = this.$('#comments');
            if (commentsDiv.hasClass('hidden')) commentsDiv.removeClass('hidden');
        },

       	sortByVotes: function()
		{
			var parent = this;
			this.$el.find('.sortVotes').addClass('btnSort-active');
			this.$el.find('.sortTime').removeClass('btnSort-active');

			this.sortUsingNestedText(
				parent.$("#comments[data-id='" + this.model.get('_id') + "']"),
				'li.parent',
				'span.user-votes'
			);
		}

    });

    return FirebaseSocialView;

});

/*
,{
	template: 'fb-social-discussion'
}
*/