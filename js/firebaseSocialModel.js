define([
   'core/js/models/componentModel'
], function(ComponentModel) {
    
    var FirebaseSocialModel = ComponentModel.extend({

        init: function() {
            ComponentModel.prototype.init.call(this);
        }

    });

    return FirebaseSocialModel;

});