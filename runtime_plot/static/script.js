$(document).ready(function() {
    // Third-party dependencies
    $('<script/>', {src: 'https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js'}).appendTo('head');

    var TimeEstimatorAppView = Backbone.View.extend({
        el: $('#runtime_plot'),

        appTemplate: _.template([
            '<div id="runtime_plot-header">',
                '<h4>Runtime Plot</h4>',
            '</div>',
            '<div id="runtime_plot-body">',
                '<div id="chart"></div>',
                '<div id="linechart"></div>',
            '</div>',
            '<div id="runtime_plot-loader"></div>'
        ].join('')),

        initialize: function() {
            var me = this;

            me.toolId = me.$el.parent().attr('tool_id');
            me.$el.html(me.appTemplate());
            me.$body = $('#runtime_plot-body');
            me.$chart = $('#chart');
            me.$lineChart = $('#linechart');
            me.$loader = $('#runtime_plot-loader');

            var url = 'api/webhooks/runtime_plot/get_data/' + JSON.stringify({
                'tool_id': me.toolId
            });

            $.getJSON(url, function(obj) {
                me.$loader.remove();
                if (obj.success) {
                    if (obj.data.data.length > 0) {
                        me.render(obj.data.data, obj.data.units, obj.data.linechart_data);
                    } else {
                        me.$body.append($('<div/>', {
                            class: 'load-error',
                            text: 'Couldn\'t load data (see logs).'
                        }));
                    }
                } else {
                    me.$body.append($('<div/>', {
                        class: 'load-error',
                        text: 'Couldn\'t load data (see logs).'
                    }));
                    console.error('Runtime Plot: ' + obj.error);
                    console.error(obj);
                }
            });
        },

        render: function(data, units, linechart_data) {
            var me = this;

            // Column Chart
            var chart = new CanvasJS.Chart('chart', {
                title:{
                    text: me.toolId + '\'s observed runtime',
                    fontFamily: 'Verdana',
                    fontSize: 16
                },
                data: [{
                    dataPoints: data
                }],
                axisX: {
                    title : 't, ' + units,
                    titleFontSize: 14
                },
                axisY: {
                    title : '# of runs',
                    titleFontSize: 14
                }
            });
            me.$chart.show();
            chart.render();

            // Line Chart
            // var lineChart = new CanvasJS.Chart('linechart', {
            //     animationEnabled: true,
            //     zoomEnabled: true,
            //     title: {
            //         text: me.toolId + '\'s observed runtime',
            //         fontFamily: 'Verdana',
            //         fontSize: 16
            //     },
            //     data: [
            //         {
            //             type: 'spline',
            //             dataPoints: linechart_data
            //         }
            //     ],
            //     axisY: {
            //         title : 't, ' + units,
            //         titleFontSize: 14
            //         // interval: 1
            //     }
            // });
            // me.$lineChart.show();
            // lineChart.render();

            return this;
        }
    });

    new TimeEstimatorAppView();
});
