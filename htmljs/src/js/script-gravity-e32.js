var gdcurl = "/gdc";

function mac2str(macs) {
    if (macs.length !== 6) {
        throw new Error("MAC address must be an array of 6 integers");
    }
    var revmac= macs.toReversed();
    const macString = revmac.map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(':');
    return macString;
}

function pillAddress(mac){
    var reg=mac.slice(0);
    reg[0] = reg[0] - 2;
    return mac2str(reg) +"(" + mac2str(mac) +")";
}

function toFixed() {
    var texts = document.querySelectorAll("input[type=text]");
    for (var i = 0; i < texts.length; i++) {
        texts[i].onchange = function() {
            if (this.value.match(/[\-\d\.]+e[\+\-][\d]+/))
                this.value = Number(this.value).toFixed(9);
        };
    }
}
function ptcConvert(pts,enc){
    var ret=[];
    pts.forEach(function(pt){
        if(enc) ret.push([pt[0]*1000,pt[1]*1000]);
        else ret.push([pt[0]/1000,pt[1]/1000]);
    });
    return ret;
}

function fill(setting) {
    Q("#device-type").value = setting.dev;
    window.device=setting.dev;

    for (var name in setting) {
        var ele = Q("input[name=" + name + "]");
        if (ele) {
            if (ele.type == "checkbox") ele.checked = setting[name];
            else ele.value = setting[name];
        }
    }
    if(typeof setting["color"] != "undefined") Q("#tiltcolor").value = setting.color;
    if(typeof setting["tcpts"] != "undefined"){
        TCEditor.setPoints(ptcConvert(setting.tcpts,false));
    }
    if(typeof setting["mac"]!= "undefined"){
        Q("#pilladdr").innerHTML = pillAddress(setting["mac"]);
        window.pMAC = setting["mac"];
    }
}

function getTiltCals(pts){
    if(pts.length ==0){
        return [0,1,0,0];
    } else if(pts.length ==1){
        return [pts[0][1] - pts[0][0] ,1,0,0];
    } else {
        var poly = regression('polynomial', pts, (pts.length > 3) ? 3 : ((pts.length > 2) ? 2 : 1), {
            precision: 9
        });
        return [
            poly.equation[0],
            poly.equation[1],
            (pts.length > 2)? poly.equation[2]:0,
            (pts.length > 3)? poly.equation[3]:0,
        ];
    }
}

function save() {
    var inputs = document.getElementsByTagName("input");
    var setting = {};

    setting.dev = window.device;

    for (var i = 0; i < inputs.length; i++) {
        var ele = inputs[i];
        if(ele.name != "ispindel" && ele.name!="tilthydrometer"){
            if (ele.type == "checkbox") setting[ele.name] = ele.checked;
            else if (ele.type == "text") setting[ele.name] = ele.value;
        }
    }
    if(setting.dev ==2){
        setting.color =  Q("#tiltcolor").value;
        setting.tcpts= ptcConvert(TCEditor.getPoints(),1);
        setting.tiltcoe = getTiltCals(TCEditor.getPoints());        
    }else if(setting.dev ==3){
       if(typeof window.pMAC == "undefined"){
            alert("Invlid Pill selected");
            return;
       }
       setting.mac =  window.pMAC;
    }
    //    console.log("result=" + setting);
    s_ajax({
        url: gdcurl,
        m: "POST",
        mime: "aplication/json",
        data: JSON.stringify(setting),
        success: function(a) {
            alert("<%= done %>");
        },
        fail: function(a) {
            alert("<%= script_control_failed_updating_data %>" + a)
        }
    });
}

function displaysub(){
    const i_h=[1,0,1,1];
    const t_h=[1,1,0,1];
    const p_h=[1,1,1,0];
    var d=window.device;
    Q("#ispindel-pane").style.display = i_h[d]? "none":"";
    Q("#tilt-pane").style.display = t_h[d]? "none":"";
    Q("#pill-pane").style.display = p_h[d]? "none":"";
}

function validSG(g){
    if(g > 0.8 && g<1.5) return true;
    return false;
}
var TCEditor={
init:function(){
    var tr=Q("#tiltcalpoints tr.calpoint");
    tr.parentNode.removeChild(tr);
    this.tr=tr;
    this.points=[];
},
getPoints:function(){
    return this.points;
},
setPoints:function(points){
    this.points=points;
    this.render();
},
add:function(){
    var uncal = parseFloat(Q("#uncalvalue").value);
    var cal = parseFloat(Q("#calvalue").value);
    if(!validSG(uncal) || !validSG(cal)) return;

    this.points.push([uncal,cal]);
    Q("#tiltcalpoints tbody").appendChild(this.newPoint(this.points.length-1 ,[uncal,cal]));
},
clear:function(){
    doAll("#tiltcalpoints tr.calpoint",function(div){
        div.parentNode.removeChild(div);
    });
    this.points=[];
},
newPoint:function(idx,data){
    var tr= this.tr.cloneNode(true);
    var t=this;
    tr.querySelector(".delbutton").onclick=function(e){
        e.preventDefault();
        console.log("del "+idx);
        t.points.splice(idx,1);
        doAll("#tiltcalpoints tr.calpoint",function(div){
            div.parentNode.removeChild(div);
        });
        t.render();
        return false;
    };

    tr.querySelector(".uncaldata").innerHTML="" + data[0];
    tr.querySelector(".caldata").innerHTML="" + data[1];

    return tr;
},

render:function(){
    for(var i=0;i< this.points.length;i++){
        var tr=this.newPoint(i,this.points[i]);
        Q("#tiltcalpoints tbody").appendChild(tr);
    }
}
};

function tiltcal(){
    Q("#dlg_addcalpoint").style.display="block";
}
function closeTiltCal(){
    Q("#dlg_addcalpoint").style.display="none";
    return false;
}

function init(classic) {
    if (typeof classic == "undefined") classic = false;
    window.device=0; // default to NONE
    displaysub();
    Q("#device-type").onchange=function(){
        window.device = Q("#device-type").value;
        displaysub();
    };

    toFixed();
    s_ajax({
        url: gdcurl + "?data",
        m: "GET",
        success: function(a) {
            fill(JSON.parse(a));
            displaysub();
        },
        fail: function(a) {
            alert("failed getting data:" + a)
        }
    });
    TCEditor.init();
    DevSelect.init();
    
    if (!classic) {
        getActiveNavItem();
        Q("#verinfo").innerHTML = "v" + JSVERSION;
    }
}

var DevSelect={
init:function(){
    var tr=Q("#dlg_sel_dev tr.device-list-row");
    tr.parentNode.removeChild(tr);
    this.tr=tr;
    this.list=[];
},
close:function (){
    DevSelect.stopScan();
    Q("#dlg_sel_dev").style.display="none";
},
select:function(r){
    Q("#devsel-done").disabled = false;
    DevSelect.deviceSelected = r;
    if(window.device ==2){
        Q("#tiltcolor").value = r.c;
    }else{
        Q("#pilladdr").innerHTML = pillAddress(r.a);
        window.pMAC = r.a;
    }
},
done: function (){
    DevSelect.close();
},
    
requestScan:function (){
    this.list=[];
    var url = (window.device == 2)? "/tcmd?scan=1":"/pill?scan=1" 
    s_ajax({
        url: url,
        success: function(a) {
        },
        fail: function(a) {
            DevSelect.fail("Error on connecting to controller.");
        }
    });
},

stopScan:function (){
    this.list=[];
    var url = (window.device == 2)? "/tcmd?scan=0":"/pill?scan=0" 
    s_ajax({
        url: url,
        success: function(a) {
        },
        fail: function(a) {
        }
    });
},

fail:function(msg){
    Q("#neterror").innerHTML = msg;
},
addRow:function(dev, isTilt){
    const Color=["Red","Green","Black","Purple","Orange","Blue","Yellow","Pink"];

        var tr= DevSelect.tr.cloneNode(true);
        tr.querySelector(".sg").innerHTML="" + dev.g;
        tr.querySelector(".temp").innerHTML ="" + dev.t;
        tr.querySelector(".rssi").innerHTML=""+ dev.r;
        tr.querySelector(".did").innerHTML="" + (isTilt? Color[dev.c]:pillAddress(dev.a));
        tr.addEventListener('click', function() {
            doAll("#devseltable tr.device-list-row",function(div){
                div.classList.remove('selected');
            });
            // Add 'selected' class to the clicked row
            this.classList.add('selected');
            DevSelect.select(dev);
        });
        Q("#devseltable tbody").appendChild(tr);
},
scanResult:function (r){
    var isTilt=(typeof r["tilt"]!= "undefined");
    var dev = isTilt? r.tilt:r.pill;
    var duplicated = false;
    function maccom(m1,m2){
        for(var i=0;i<6;i++) if(m1[i] != m2[i]) return false;
        return true;
    }
    if(isTilt) DevSelect.list.forEach(function(sdev){
        if(dev.c == sdev.c) duplicated=true;
    });
    else DevSelect.list.forEach(function(sdev){
        if(maccom(dev.a,sdev.a)) duplicated=true;
    });
    if(duplicated) return;
    DevSelect.list.push(dev);
    DevSelect.addRow(dev,isTilt);
},

 connect:function(){
    if(typeof window.connecting != "undefined") return true;
    window.connect=true;
    window.TU = 'F';
    BWF.init({
        //     reconnect: false,
        onconnect: function() {
            // send 
            DevSelect.requestScan();
        },
        error:function(e){
            DevSelect.fail("Failed to connect to the controller.");
        },
        handlers:{
            T:function(j){
                DevSelect.scanResult(j);
            },
            A:function(info){
                if(typeof info["tu"] != "undefined") window.TU = info.tu;
            }
        }});
    return false;
},

scan:function(){
    Q("#devsel-done").disabled = true;
    doAll("#devseltable tr.device-list-row",function(div){
        div.parentNode.removeChild(div);
    });
    if(DevSelect.connect()){
        DevSelect.requestScan();
    }
    Q("#neterror").innerHTML = "Searching for Device...";
    Q("#dlg_sel_dev").style.display="block";
}
};
