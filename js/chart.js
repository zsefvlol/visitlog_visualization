/**
 * Created by Mengtian on 2015/05/06.
 */

//global refs
var _lastForceRef;
var _originalJson;

//load data
d3.json(dataUrl, function(error, originalJson) {
    _originalJson = originalJson;
    update($.extend(true,[],originalJson),{"visit_count_drop_percentage": 10, "forward_count_drop_percentage": 10, "extra_node_list" : []});
});

//build range
var buildDataRange = function (jsonData, config){
    var dataRange = {};
    dataRange.max_visit_count = 0;
    for (var i in jsonData) {
        if (dataRange.max_visit_count < jsonData[i].statistics.visit_count)
            dataRange.max_visit_count = jsonData[i].statistics.visit_count;
    }
    dataRange.min_visit_count = dataRange.max_visit_count / 100 * config.visit_count_drop_percentage;

    dataRange.max_forward_count = 0;
    for (i in jsonData)
        for(var j in jsonData[i].forward_list){
            if(dataRange.max_forward_count < jsonData[i].forward_list[j].forward_count)
                dataRange.max_forward_count = jsonData[i].forward_list[j].forward_count;
        }
    dataRange.min_forward_count = dataRange.max_forward_count / 100 * config.forward_count_drop_percentage;
    return dataRange;
};

//filter data
var dataFilter = function (jsonData, dataRange){
    for (var i in jsonData)
        if (dataRange.min_visit_count > jsonData[i].statistics.visit_count)
            delete jsonData[i];

    for (i in jsonData){
        for(var j in jsonData[i].forward_list){
            if(jsonData[i].forward_list[j].forward_count < dataRange.min_forward_count
            || typeof jsonData[j] == 'undefined')
                delete jsonData[i].forward_list[j];
        }
    }
    return jsonData;
};

//main update
var update = function(originalJson,config){

    //init functions and variables
    var width = document.body.clientWidth - 5,
        height = document.body.clientHeight - 5;
    var dataRange = buildDataRange(originalJson,config);
    var xScaleVisitCount = d3.scale.linear().domain([dataRange.min_visit_count, dataRange.max_visit_count]);
    var xScaleForwardCount = d3.scale.linear().domain([dataRange.min_forward_count, dataRange.max_forward_count]);
    var jsonData = dataFilter(originalJson, dataRange);

    var linkCircleSize = 3;

    var links = [];
    var nodes = {};

    //hold last position
    if (_lastForceRef) {
        var lastNodesPosition = {};
        var lastNodes = _lastForceRef.nodes();
        for (var lastNode in lastNodes)
            lastNodesPosition[lastNodes[lastNode].name] = lastNodes[lastNode];
    }

    //build nodes
    for(var sourceKey in jsonData){
        nodes[sourceKey] = {
            name:sourceKey,
            statistics:jsonData[sourceKey].statistics,
            forward_list:jsonData[sourceKey].forward_list,
            x: Math.round(Math.random() * width * 0.3) * (Math.random() >0.5 ? 1 : -1) + width/2,
            y: Math.round(Math.random() * height * 0.3) * (Math.random() >0.5 ? 1 : -1) + height/2
        };
        if(lastNodesPosition && lastNodesPosition[sourceKey]){
            nodes[sourceKey].x = lastNodesPosition[sourceKey].x;
            nodes[sourceKey].y = lastNodesPosition[sourceKey].y;
        }
    }
    for(sourceKey in jsonData){
        for(var targetKey in jsonData[sourceKey]['forward_list']){
            links.push({
                source : nodes[sourceKey],
                target : nodes[targetKey],
                statistics : jsonData[sourceKey]['forward_list'][targetKey]
            });
        }
    }

    //init force
    var force = d3.layout.force()
        .nodes(d3.values(nodes))
        .links(links)
        .size([width, height])
        .linkDistance(function(d){
            return xScaleForwardCount.range([80, 240])(d.statistics.forward_count);
        })
        .charge(function(d){
            if(typeof jsonData[d.name] == 'undefined') return 0;
            return -xScaleVisitCount.range([400, 1200])(d.statistics.visit_count);
        });


    _lastForceRef = force;

    //init svg
    d3.select(".force_svg").remove();
    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("margin", 0)
        .attr("padding",0)
        .attr("class","force_svg");

    //build sidebar
    var displaySidebar = function(d){
        d3.selectAll('.sidebar_group').remove();
        var sidebarGroup = svg.append("g").attr("class","sidebar_group")
            .attr('transform',"translate(50,150)").style("opacity", 0);
        sidebarGroup.transition().duration(200).style("opacity", 100);
        var buildLine = function(y,l1,text,textNum){
            var maxLength = 100;
            l1 = l1 || 0;
            if(l1 > maxLength * 1.2) l1 = maxLength * 1.2;
            if(l1 < 0) l1 = 0;
            sidebarGroup.append("text").text(0).attr("class","sidebar_text")
                .attr('transform',"translate(0,"+y+")")
                .transition().tween("text", function(){
                    var i = d3.interpolate(0, textNum);
                    return function(t) {
                        if(Math.round(textNum) != textNum)
                            this.textContent = text + i(t).toFixed(3);
                        else
                            this.textContent = text + i(t).toFixed();
                    };
                });
            sidebarGroup.append("line").attr("x1",0).attr("y1",0).attr("x2",maxLength).attr("y2",0)
                .attr('transform',"translate(0,"+(y+7)+")")
                .attr('stroke',"rgba(62,64,80,0.3)").attr("stroke-width",6);
            sidebarGroup.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",0)
                .attr('transform',"translate(0,"+(y+7)+")")
                .attr('stroke',"rgba(62,64,80,1)").attr("stroke-width",6)
                .transition().attr('x2',l1).duration(500).delay(50);
        };

        var xScaleTime = d3.scale.linear().domain([0,20]).range([0,100]);
        sidebarGroup.append("text").text('STATISTICS').attr("class","sidebar_text")
            .attr('transform',"translate(0,7)");
        buildLine(30,xScaleTime(d.statistics.average_stay_time),'Average Stay Time: ',d.statistics.average_stay_time);
        buildLine(60,xScaleVisitCount(d.statistics.enter_count),'Enter Count: ',d.statistics.enter_count);
        buildLine(90,xScaleVisitCount(d.statistics.exit_count),'Exit Count: ',d.statistics.exit_count);
        buildLine(120,xScaleVisitCount(d.statistics.visit_count),'Visit Count: ',d.statistics.visit_count);
        sidebarGroup.append("text").text('FORWARD LIST').attr("class","sidebar_text")
            .attr('transform',"translate(0,157)");
        var y = 180;
        for(var i in d.forward_list){
            buildLine(y,xScaleForwardCount.range([0,100])(d.forward_list[i].forward_count), i.replace('_',' ') + ': ',d.forward_list[i].forward_count);
            y+=30;
        }
    };

    //path group
    var pathGroup = svg.append("g").attr("class","link_group").selectAll("g")
        .data(force.links()).enter().append("g");

    //path
    var path = pathGroup.append("path")
        .attr("class", "link")
        .attr("stroke", function(d){
            return 'rgba(62,64,80,' + xScaleForwardCount.range([0.3, 1])(d.statistics.forward_count) + ')';
        })
        .attr("fill", "none")
        .attr("stroke-dasharray", "4,2")
        .attr("stroke-width",function(d){
            return xScaleForwardCount.range([1, 3])(d.statistics.forward_count);
        });

    //end circle in path, show the direction of path
    var linkCircle = pathGroup.append("circle")
        .attr("fill","white")
        .attr("stroke",function(d){
            return 'rgba(62,64,80,' + xScaleVisitCount.range([0.8, 1])(d.statistics.forward_count) + ')';
        })
        .attr("cx",-100)
        .attr("cy",-100)
        .attr("stroke-width",1)
        .attr("r", linkCircleSize)
        .attr("class", 'linkCircle');

    //calculate hexagon points
    var hexagonPoints = function(r, x, y){
        x = x || 0;
        y = y || 0;
        var s = r / 2;
        var h = s * Math.sqrt(3);
        return (-s+x) + "," + (-h+y) + " "
            + (+s+x) + "," + (-h+y) + " "
            + (+r+x) + "," + (0+y) + " "
            + (+s+x) + "," + (+h+y) + " "
            + (-s+x) + "," + (+h+y) + " "
            + (-r+x) + "," + (0+y);
    };

    // define the nodes
    var node = svg.append("g").attr("class","node_group").selectAll(".node")
        .data(force.nodes())
        .enter().append("g")
        .attr("class", "node")
        .call(force.drag);

    //mouse over/out show/hide side bar
    node
        .on('mouseover',function(d){displaySidebar(d)})
        .on('mouseout',function(d){d3.selectAll('.sidebar_group').transition().duration(200).style("opacity", 0).remove();});

    //visit count polygon
    node.append("polygon")
        .attr("class", "visitHexagon")
        .attr("points", function(d){
            var r = xScaleVisitCount.range([10, 50])(d.statistics.visit_count);
            return hexagonPoints(r);
        })
        .attr("fill","#FFFFFF")
        .attr("stroke-width","3")
        .attr("stroke", function(d){
            return 'rgba(62,64,80,' + xScaleVisitCount.range([0.8, 1])(d.statistics.visit_count) + ')';
        });

    //enter count polygon
    node.append("polygon")
        .attr("class", "enterHexagon")
        .attr("points", function(d){
            var r_visit = xScaleVisitCount.range([10, 50])(d.statistics.visit_count);
            var light = xScaleVisitCount.range([config.visit_count_drop_percentage, 100])(d.statistics.enter_count);
            if (light > 3) // > 3% are entry
                return hexagonPoints(r_visit - 10);
            return '';
        })
        .attr("fill",function(d){
            var color = ['#E9544F','#F29F8F','#FBE2DA'];
            var light = xScaleVisitCount.range([config.visit_count_drop_percentage, 100])(d.statistics.enter_count);
            if (light < 5) return color[0];
            if (light < 15) return color[1];
            return color[2]
        })
        .attr("stroke-width","2")
        .attr("stroke", function(d){
            return 'rgba(62,64,80,' + xScaleVisitCount.range([0.8, 1])(d.statistics.visit_count) + ')';
        });

    //node text
    node.append("text")
        .attr("x", 0)
        .attr("y", function(d){
            var width = xScaleVisitCount.range([15, 50])(d.statistics.visit_count) / 2 * Math.sqrt(3);
            return width < 30 ? width + 9 : -2;
        })
        .attr("text-anchor","middle")
        .text(function(d) {return d.name.split('_')[0];});

    node.append("text")
        .attr("x", 0)
        .attr("y", function(d){
            var width = xScaleVisitCount.range([15, 50])(d.statistics.visit_count) / 2 * Math.sqrt(3);
            return width < 30 ? width + 18 : 9;
        })
        .attr("text-anchor","middle")
        .text(function(d) {return d.name.split('_')[1];});


    //slider
    var sliderGroup = svg.append("g").attr("class","slider_group");
    var buildSlider = function(g, key, x1, y1){
        var slider_width = 100;
        var slider = g.append("g").attr("class", 'slider_'+key);
        slider.append("text").attr("x",x1-5).attr("y",y1+16).text(key.replace('_',' ').toUpperCase()).attr('display','none');
        slider.append("line").attr("x1",x1+4).attr("y1",y1).attr("x2",x1+slider_width-4).attr("y2",y1)
            .attr('stroke',"rgba(62,64,80,1)").attr("stroke-width",2);
        slider.append("polygon").attr("points",hexagonPoints(5))
            .attr("fill","rgba(62,64,80,0.8)")
            .attr('transform',"translate("+x1+","+y1+")");
        slider.append("polygon").attr("points",hexagonPoints(5))
            .attr("fill","rgba(62,64,80,0.8)")
            .attr('transform',"translate("+(x1+slider_width)+","+y1+")");
        slider.append("polygon").attr("points",hexagonPoints(8))
            .attr('transform','translate('+ (x1+d3.scale.linear().domain([2,50]).range([0,slider_width])(config[key])) +','+ y1 +')')
            .attr("fill","#FFFFFF")
            .attr("stroke","rgba(62,64,80,1)").attr("stroke-width",2)
            .on('mouseover',function(){
                d3.select(this.parentNode).select("text").attr('display','block');
            })
            .on('mouseout',function(){
                d3.select(this.parentNode).select("text").attr('display','none');
            })
            .call(d3.behavior.drag()
                .on("drag",function(){
                    var current =  d3.select(this).attr("transform");
                    current = current.replace('translate(','').replace(')','').split(',');
                    var x = d3.event.x;
                    if(x > x1+slider_width) x=x1+slider_width;
                    if(x < x1) x=x1;
                    d3.select(this).attr("transform", "translate(" + x + "," + current[1] + ")");
                })
                .on("dragend",function(){
                    var current =  d3.select(this).attr("transform");
                    current = current.replace('translate(','').replace(')','').split(',');
                    config[key] = d3.scale.linear().domain([0,slider_width]).range([2,50])(current[0]-x1);
                    update($.extend(true,[],_originalJson),config);
                }));
    };
    buildSlider(sliderGroup,'visit_count_drop_percentage',50,50);
    buildSlider(sliderGroup,'forward_count_drop_percentage',50,100);

    //tick
    var tick = function() {

        //build path by arc
        path.attr("d", function(d) {
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            if (dr == 0) return '';
            var p = "M" +
                (d.source.x) + "," + (d.source.y) + "A" +
                dr + "," + dr + " " + "0,0,1 " +
                (d.target.x) + "," + (d.target.y);
            return p;

        });

        //move node
        node.attr("transform", function(d) {return "translate(" + d.x + "," + d.y + ")"; });

        //calculate circle position
        linkCircle.each(function(d){
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            if (dr == 0) return '';

            var r = xScaleVisitCount.range([10, 50])(d.target.statistics.visit_count) + linkCircleSize + 2;
            var s = r / 2;
            var h = s * Math.sqrt(3);
            var inter = Intersection.intersectShapes(
                new IntersectionParams.newArc(
                    new Point2D(d.source.x, d.source.y),
                    new Point2D(d.target.x, d.target.y),
                    dr, dr, 0, false, true
                ),
                new IntersectionParams.newPolygon([
                        new Point2D(d.target.x-s, d.target.y-h),
                        new Point2D(d.target.x+s, d.target.y-h),
                        new Point2D(d.target.x+r, d.target.y),
                        new Point2D(d.target.x+s, d.target.y+h),
                        new Point2D(d.target.x-s, d.target.y+h),
                        new Point2D(d.target.x-r, d.target.y)]
                )
            );

            if(inter.points.length){
                var x = inter.points[0].x;
                var y = inter.points[0].y;
                d3.select(this).attr({cx : x, cy : y})
            }

        });

    };

    //bind tick
    force.on("tick", tick).start();
    
};
