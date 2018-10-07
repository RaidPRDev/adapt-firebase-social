define([
    'core/js/adapt',
    './firebaseSocialView',
    './firebaseSocialModel'
], function(Adapt, FirebaseSocialView, FirebaseSocialModel) {

    return Adapt.register("fb-social-discussion", {
        view: FirebaseSocialView,
        model: FirebaseSocialModel
    });

});