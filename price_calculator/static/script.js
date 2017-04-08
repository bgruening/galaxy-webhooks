$(document).ready(function() {
    // Third-party dependencies
    $('<script/>', {src: 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js'}).appendTo('head');

    var ControlCollection = Backbone.Collection.extend({});

    var ProviderModel = Backbone.Model.extend({
        initialize: function() {
            this.set('_controls', new ControlCollection());
        }
    });

    var ProviderCollection = Backbone.Collection.extend({
        url: 'api/webhooks/price_calculator/get_data',
        model: ProviderModel
    });

    var ControlsView = Backbone.View.extend({
        el: '#price_calculator-controls',

        template: _.template([
            '<% _controls.each(function(control) { %>',
                '<div class="control-container">',
                    '<div class="input-group">',
                        '<input type="text" id="<%= control.attributes.name %>" class="form-control" placeholder="<%= control.attributes.label %>"></input>',
                        '<span class="input-group-addon control-units"><%= control.attributes.units %></span>',
                        '<% if (control.attributes.tooltip) { %>',
                            '<span class="input-group-addon" data-toggle="tooltip" data-placement="right" data-container="body" title="<%= control.attributes.tooltip %>">?</span>',
                        '<% } %>',
                    '</div>',
                '</div>',
            '<% }); %>'
        ].join('')),

        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        }
    });

    var PriceCalculatorAppView = Backbone.View.extend({
        el: $("#price_calculator"),

        appTemplate: _.template([
            '<div id="price_calculator-header">',
                '<h4>Price Calculator</h4>',
            '</div>',
            '<div id="price_calculator-providers">',
                '<select id="provider-list"></select>',
                '<hr/>',
            '</div>',
            '<div id="price_calculator-controls"></div>',
            '<div id="price_calculator-total-price"></div>',
            '<div id="price_calculator-loader"></div>'
        ].join('')),

        calculateButtonTemplate: _.template([
            '<div class="text-centered">',
                '<button id="calculateBtn" class="btn btn-default">Calculate</button>',
            '</div>'
        ].join('')),

        totalPriceTemplate: _.template([
            'Total Price: ',
            '<span class="total-price"><%= price %> </span>',
            '<span class="total-price-currency"><%= currency %>/month</span>',
        ].join('')),

        events: {
            'change #provider-list': 'onProviderChange',
            'click #calculateBtn': 'onCalculateBtnClick'
        },

        initialize: function() {
            var me = this;

            me.$el.html(this.appTemplate());
            me.providerCollection = new ProviderCollection();
            me.$calculatorProviders = $('#price_calculator-providers');
            me.$providerList = $('#provider-list');
            me.$calculatorControls = $('#price_calculator-controls');
            me.$calculatorTotalPrice = $('#price_calculator-total-price');
            me.$loader = $('#price_calculator-loader');

            // Hide Total Price
            me.$calculatorTotalPrice.hide();

            // Get all information about providers
            $.get({
                url: 'api/webhooks/price_calculator/get_data',
                success: function(data) {
                    if (data.providers.length > 0) {
                        me.totalDataSize = data.size;
                        me.providerCollection.add(data.providers);

                        me.showAmazonTotalPrice();

                        me.providerCollection.each(function(provider) {
                            provider.attributes._controls.add(provider.attributes.controls);
                            provider.unset('controls');
                        });

                        me.$calculatorProviders.show();
                        me.$loader.remove();
                        me.render(me.providerCollection);
                    } else {
                        me.$loader.remove();
                        me.$calculatorControls.append($('<div/>', {
                            class: 'load-error',
                            text: 'Couldn\'t load providers (see logs).'
                        }));
                    }
                }
            });
        },

        showAmazonTotalPrice: function() {
            var amazon = this.providerCollection.where({name: 'Amazon S3'})[0].toJSON(),
                amazonFormula = amazon.formula;

            // Replace all param values in the formula
            _.each(amazon.params, function(value, name) {
                amazonFormula = amazonFormula.replace(new RegExp(name, 'g'), value);
            });

            // Replace storage size value with real value
            amazonFormula = amazonFormula.replace(
                new RegExp('storage_value', 'g'), this.totalDataSize
            );

            // Show Amazon Total Price
            var amazonTotalPrice = eval(amazonFormula);  // jshint ignore:line
            $('#price_calculator-header').append(
                $('<span/>', {
                    id: 'amazon-total-price',
                    text: 'You\'re using ' + this.totalDataSize + ' GB of data, ' +
                          'this would cost you ' + this.setPrecision(amazonTotalPrice) + ' ' +
                          amazon.currency + '/month on Amazon S3'
                })
            );
        },

        render: function(providers) {
            var me = this;

            // Add providers to Provider List
            providers.each(function(provider) {
                var model = provider.toJSON();
                me.$providerList.append($('<option/>', {
                    text: model.name,
                    value: model.value
                }));
            }, me);

            // // Render all controls of a currently selected provider
            me.renderControls(providers.models[0]);

            return me;
        },

        renderControls: function(provider) {
            var controlsView = new ControlsView({model: provider});
            controlsView.render();

            // Initialize tooltips
            $('[data-toggle="tooltip"]').tooltip();

            // Show Calculate button
            this.$calculatorControls.append(this.calculateButtonTemplate());

            // Set Standard Storage value based on user data usage
            $('#storage_value').val(this.totalDataSize);

            // If a provider has only one control (Standard Storage),
            // calculate the price immediately
            if (provider.attributes._controls.length == 1) {
                $('#calculateBtn').click();
            }
        },

        onCalculateBtnClick: function() {
            var provider = this.providerCollection.where({
                value: this.$providerList.val()
            })[0];
            var controls = provider.attributes._controls;

            if (this.isValid(controls)) {
                this.renderTotalPrice(provider);
            }
        },

        onProviderChange: function(e) {
            var providerValue = e.target.value,
                provider = this.providerCollection.where({value: providerValue})[0];

            this.$calculatorControls.empty();
            this.$calculatorTotalPrice.hide();
            this.renderControls(provider);
        },

        renderTotalPrice: function(provider) {
            var providerModel = provider.toJSON(),
                formula = providerModel.formula;

            // Replace all param values in the formula
            _.each(providerModel.params, function(value, name) {
                formula = formula.replace(new RegExp(name, 'g'), value);
            });

            // // Replace all input values in the formula
            providerModel._controls.each(function(control) {
                var name = control.attributes.name,
                    $item = $('#' + name),
                    value = parseFloat($item.val()),
                    $controlContainer = $item.parent().parent(),
                    $errorMsg = $controlContainer.children('.help-block');

                formula = formula.replace(new RegExp(name, 'g'), value);

                // Clear error message
                $controlContainer.toggleClass('has-error', false);
                if ($errorMsg) {
                    $errorMsg.remove();
                }
            });

            // Evaluate the formula
            var totalPrice = eval(formula);  // jshint ignore:line
            this.$calculatorTotalPrice.html(this.totalPriceTemplate({
                price: this.setPrecision(totalPrice),
                currency: providerModel.currency
            }));

            // Show Total Price
            this.$calculatorTotalPrice.show();
        },

        isNumber: function(value) {
            var pattern = new RegExp(/^[0-9]+([.,][0-9]+)?$/);
            return pattern.test(value);
        },

        isValid: function(controls) {
            var me = this,
                valid = false;

            controls.each(function(control) {
                var model = control.toJSON(),
                    $item = $('#' + model.name),
                    $controlContainer = $item.parent().parent(),
                    value = $item.val();

                if (value !== '') {
                    if (me.isNumber(value)) {
                        valid = true;
                    } else {
                        // Mark invalid (only number is allowed)
                        me.showErrorMsg($controlContainer, 'Only integers and decimals are allowed.');
                        valid = false;
                        me.$calculatorTotalPrice.hide();
                    }
                } else {
                    // Mark invalid (cannot be empty)
                    me.showErrorMsg($controlContainer, 'This field cannot be empty.');
                    valid = false;
                    me.$calculatorTotalPrice.hide();
                }
            });

            return valid;
        },

        showErrorMsg: function($parent, msg) {
            $parent.toggleClass('has-error', true);

            var $errorMsg = $parent.children('.help-block');
            if ($errorMsg.length === 0) {
                $parent.append($('<span/>', {class: 'help-block', text: msg}));
            } else {
                $errorMsg.text(msg);
            }
        },

        setPrecision: function(value) {
            var precision = Math.abs(Math.floor(Math.log10(value))) + 1;
            if (precision <= 3) precision = 2;
            return value.toFixed(precision);
        }
    });

    new PriceCalculatorAppView();
});
