define('components/adapt-firebase-social/js/adapt-firebase-social',[
'require',
'coreViews/componentView',
'coreJS/adapt'],
function(require) {
	
	var ComponentView = require('coreViews/componentView');
	var Adapt = require('coreJS/adapt');

	var FBSocial = ComponentView.extend({
		events: {
			'click button': 'pushComment',
			'click .delete': 'deleteComment',
			'click .upvote, .downvote': 'vote',
			'click .sortTime': 'sortByTime',
			'click .sortVotes': 'sortByVotes',
			'click .toggle': 'toggleComments',
			'click .toggleReply': 'toggleReply'
		},
		postRender: function() {
			var parent = this;
			this.pointsData = [];
			var ref = firebase
				.database()
				.ref('chat/' + this.model.get('_firebaseID'));

			ref.on('child_added', function(snapshot) {

				// console.log("postRender");

				if (snapshot.exists()) {
                    console.log("postRender");
					$('.social-leaderboard').show();
                    var id = snapshot.key;
                    var comment = snapshot.val();
                    var points = comment.upvotes + comment.children;
                    parent.displayComment(id, comment);
                    parent.pointsData.push({
                        ldap: comment.ldap,
                        points: points,
                        location: comment.location,
                        id: id
                    });
                    // parent.updateLeaderboard(parent.pointsData);
                    parent.sortByTime();
                }
            });

            $('.hidden-comments .items-start').remove();
			
			this.setReadyStatus();
			this.setCompletionStatus();
		},
		findParent: function(parentId) {
			return this.$el.find('#comments').find('[data-id="' + parentId + '"] > ul');
		},
		displayComment: function(id, comment) {

			var $parent = comment.parent ?
				this.findParent(comment.parent) :
				this.$el.find("#comments[data-id='" + this.model.get('_id') + "']");
				
			if (this.$el.find("#comments li[data-id=" + id + "]").length > 0) return;
			
			var $el = this.addComment(id, comment);
			$el.attr('data-id', id);
			$el.hide();
			$parent.prepend($el);
			$el.fadeIn('slow');
			!comment.parent && $el.addClass('parent');

			this.$el.find("#comments[data-id='" + this.model.get('_id') + "']")
				.find('.sub-comments')
				.each(function() {
					$(this)
						.parent('li')
						.find('.toggle.reply-count')
						.html($(this).children('li').length + ' replies'); //display child comment count
					$(this)
						.parent('li')
						.find('.toggle.reply-button')
						.html('<i class="material-icons">arrow_downward</i><i class="material-icons hidden">arrow_upward</i> Show ' + $(this).children('li').length + ' replies'); //display child comment count
				});
		},
		addComment: function(id, comment) {
			var parent = this;
			var name = Adapt.fullName;
			var ref = firebase
				.database()
				.ref('chat/' + this.model.get('_firebaseID'));
			var upvotesMod = ref.child(id).child('upvotesMod');
			var post = this.$el.find('#commentTemplate')
				.clone()
				.attr('id', null)
				.find('span.user-username')
				.text(comment.name)
				.end();
			var justDate = comment.time.substr(0, comment.time.indexOf(' '));
			var justTime = comment.time.substr(comment.time.indexOf(' ') + 1);
			if (comment.name === this.model.get('hostName')) {
				post
					.find('span.user-username')
					.addClass(
						'orange-background white-text-color bold rounded px2'
					);
			}
			if (comment.name === this.model.get('hostName2')) {
				post
					.find('span.user-username')
					.addClass('green-background white-text-color bold px2');
			}
			if (comment.parent) {
				post.find('.sub-comments').hide();
			}
			if (Adapt.fullName !== 'Indranil Bora') {
				post.find('.delete').remove();
			}
			post.find('span.user-votes').attr('id', id);
			post.find('span.user-votes').text(comment.upvotes);
			post.find('span.user-location').text(comment.location);
			post.find('i.upvote').attr('data-id', id);
			post.find('i.downvote').attr('data-id', id);
			post.find('span.user-time').text(justTime);
			post.find('span.user-date').text(justDate);
			post.find('p.user-comment').text(comment.comment);
			if (upvotesMod) {
				upvotesMod.once('value', function(snapshot) {
					var voteSnapshot = snapshot.child(name).val();
					if (voteSnapshot === 1) {
						post
							.find('i.upvote')
							.first()
							.text('favorite');
						post
							.find('i.upvote')
							.first()
							.addClass('red-text-color');
						post
							.find('span.user-votes')
							.first()
							.addClass('red-text-color');
					}
				});
			}
			return post;
		},
		pushComment: function(ev) {
			var that = this;
			var ref = firebase
				.database()
				.ref('chat/' + this.model.get('_firebaseID'));
			var name = Adapt.fullName;
			var location = Adapt.userLocation;
			var ldap = Adapt.userLDAP;
			var time = this.timeStamp();
			var $input = $(ev.currentTarget).prev('input');
			var comment = $input.val();
			var parent = $input.closest('[data-id]').attr('data-id') || null;
			var childposts =
				$input
				.closest('[data-id]')
				.find('span.toggle:first')
				.text() || null;
			var childcount = parseInt(childposts, 10) + 1 || null;

			if (parent && parent.indexOf('c-') >= 0) {
				parent = null; 
			}
			if (comment) {
				ref.push({
					name: name,
					comment: comment,
					time: time,
					upvotes: 1,
					children: 0,
					parent: parent,
					location: location,
					ldap: ldap
				});
				if (parent) {
					ref.child(parent).update({
						children: childcount
					});
				}
			}
			$input.val('');

			if ($(ev.target).hasClass('first-submit-btn')) {
				setTimeout(function() {
					$(".sortTime").trigger("click");
	            }, 2000);
			}

			return false;
		},
		deleteComment: function(ev) {
			var ref = firebase
				.database()
				.ref('chat/' + this.model.get('_firebaseID'));
			var id = $(ev.currentTarget)
				.closest('li')
				.data('id');
			ref.child(id).remove();
			this.$el.find(ev.currentTarget)
				.closest('li')
				.hide();
		},
		vote: function(ev) {
			var parent = this;
            var pointsData = parent.pointsData;
            var id = $(ev.currentTarget).data('id');
            var stringID = $(ev.currentTarget).attr('data-id');
            let obj = pointsData.find(x => x.id === stringID);
            let index = pointsData.indexOf(obj);

            var ref = firebase
                .database()
                .ref('chat/' + this.model.get('_firebaseID'));

            var name = Adapt.fullName;

            var upvotesRef = ref.child(id + '/upvotes');
            var upvotesMod = ref.child(id + '/upvotesMod/');
            upvotesMod.once('value', function(snapshot) {
                upvotesMod.child(name).set({ name: name });
                var voteSnapshot = snapshot.child(name).val();
                var votes = document.getElementById(id).innerHTML;
                if (voteSnapshot === 1) {
                    votes--;
                    pointsData.fill(obj.points--, index, index++);
                    // parent.updateLeaderboard(pointsData);
                    upvotesMod.child(name).transaction(function(current) {
                        return 0;
                    });
                    this.$(ev.currentTarget)
                        .closest('i.upvote')
                        .text('favorite_border');
                    this.$(ev.currentTarget)
                        .closest('i.upvote')
                        .removeClass('red-text-color bump');
                    this.$(ev.currentTarget)
                        .next('span.user-votes')
                        .removeClass('red-text-color');

                    upvotesRef.transaction(function(currentRank) {
                        return (currentRank || 0) - 1;
                    });
                } else {
                    votes++;
                    pointsData.fill(obj.points++, index, index++);
                    // parent.updateLeaderboard(pointsData);
                    upvotesMod.child(name).transaction(function(current) {
                        return 1;
                    });
                    this.$(ev.currentTarget)
                        .closest('i.upvote')
                        .text('favorite');
                    this.$(ev.currentTarget)
                        .closest('i.upvote')
                        .addClass('red-text-color bump');
                    this.$(ev.currentTarget)
                        .next('span.user-votes')
                        .addClass('red-text-color');

                    upvotesRef.transaction(function(currentRank) {
                        return (currentRank || 0) + 1;
                    });
                }
                document.getElementById(id).innerHTML = votes;
            });
		},
		toggleComments: function(event) {
			if (event.target && event.target.className == 'toggle reply-button') {
				var next = event.target.nextElementSibling;
				if (next.style.display == 'none') {
					$(event.currentTarget)
						.find('ul')
						.slideDown(150);
				} else {
					$(event.currentTarget)
						.siblings('ul')
						.slideToggle();
				}
			}
		},
		toggleReply: function(event) {
			if (event.target && event.target.className == 'toggleReply') {
				var next = event.target.nextElementSibling;
				if (next.style.display == 'none') {

					this.$el.find('form.subComments').slideUp(150);
					$(event.currentTarget)
						.siblings('form')
						.slideDown(150);
					$(event.currentTarget)
						.siblings('ul')
						.slideDown(150);

					if (Adapt.device.touch) {
						$(event.currentTarget)
							.siblings('form')
							.children('input');
					} else {
						$(event.currentTarget)
							.siblings('form')
							.children('input')
							.focus();
					}
					
				} else {
					$(event.currentTarget)
						.siblings('form')
						.slideToggle();
					$(event.currentTarget)
						.siblings('ul')
						.slideToggle();
				}
			}
		},
		timeStamp: function() {
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
			for (var i = 1; i < 3; i++) {
				if (time[i] < 10) {
					time[i] = '0' + time[i];
				}
			}
			return date.join('/') + ' ' + time.join(':') + ' ' + suffix;
		},
		sortUsingNestedText: function(parent, childSelector, keySelector) {
			var items = parent.children(childSelector).sort(function(b, a) {
				var vA = this.$(keySelector, a).text();
				var vB = this.$(keySelector, b).text();
				return vA < vB ? -1 : vA > vB ? 1 : 0;
			});
			parent.append(items);
		},
		sortByTime: function() {
			$('.sortVotes').removeClass('btnSort-active');
			$('.sortTime').addClass('btnSort-active');
			$("#comments[data-id='" + this.model.get('_id') + "']").empty();
			var parent = this;
			var ref = firebase
				.database()
				.ref('chat/' + this.model.get('_firebaseID'));

			ref.on('child_added', function(snapshot) {
				if (snapshot.exists()) {
					var id = snapshot.key;
					var comment = snapshot.val();
					parent.displayComment(id, comment);
				}
			});
		},
		sortByVotes: function() {
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
	Adapt.register('fb-social-discussion', FBSocial);
	return FBSocial;
});