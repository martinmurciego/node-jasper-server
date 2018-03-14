/*
Jasper Server for NodeJS
(c) 2018 Loable Technologies
Andrew M. Loable
https://loable.tech
*/
const java = require('java');
const fs = require('fs');
const path = require('path');
const util = require('util');
const tmp = require('tmp');
const sleep = require('sleep');
const async = require('async');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const vm = this;

vm.modulePath = path.dirname(__filename); // main directory
vm.libraryPath = path.join(vm.modulePath, 'libs'); // Put jars in lib directory

vm.settings = {
    reports: {},
    drivers: {},
    connections: {}
};

// Add jar to java classpath
function loadJar(file){
    if (path.extname(file) == '.jar'){
        console.log("Loading: " + file);
        java.classpath.push(file);
    }
}

// Import JasperReports
function importJasperReports(){

};

// Returns the connection identified by the report
function getReportConnection(report){
    var conn = vm.settings.connections[report.connection];
    console.log(conn);
    if (conn){
        // Return Jasper Connection
        return vm.driverManager.getConnectionSync(conn.jdbc, conn.user, conn.password);
    } else {
        console.error("Connection " + report.connection + " is not registered.");
        // Return Empty Data Source
        return new vm.jasperEmptyDataSource();
    }
};

// Parse Locale String
function parseLocaleString(str){
    var s = str.split(/[_|-]/);
    if (s.length > 1){
        return vm.locale(s[0], s[1]);
    } else {
        return vm.locale(s[0]);
    }
};

// Generate JasperPrint from a report 
function generateJasperPrint(report){
    console.log("check registered reports");
    for (var r in vm.settings.reports){
        if (report.name === r){
            report.jrxml = vm.settings.reports[r].jrxml;
            report.subreports = vm.settings.reports[r].subreports;
        }
    }

    var parameters = new vm.hashMap();

    if (report.jrxml){
        jrxmlLoader = java.callStaticMethodSync("net.sf.jasperreports.engine.xml.JRXmlLoader", "load", path.join(vm.modulePath, report.jrxml));
        report.jasper = java.callStaticMethodSync("net.sf.jasperreports.engine.JasperCompileManager", "compileReport", jrxmlLoader);
        if (report.subreports){
            console.log("subreports detected");
            for(subreport in report.subreports){
                var obj = report.subreports[subreport];
                objJrxmlLoader = java.callStaticMethodSync("net.sf.jasperreports.engine.xml.JRXmlLoader", "load", path.join(vm.modulePath, obj.jrxml));
                objJasper = java.callStaticMethodSync("net.sf.jasperreports.engine.JasperCompileManager", "compileReport", objJrxmlLoader);
                // add subreports as parameters. make sure to use parameters for subreport definition
                parameters.putSync(subreport, objJasper);
            }
        }
    } else {
        console.error("jrxml not defined in report object");
    }

    var toExports = [];

    if (report.jasper){
        var toExport = null;

        //process parameters
        if (report.parameters){
            for (var p in report.parameters) {
                if (p === "REPORT_LOCALE") {
                    report.parameters[p] = parseLocaleString(report.parameters[p]);
                }
                parameters.putSync(p, report.parameters[p]);
            }
        }

        // Get connection used by report
        var connection = getReportConnection(report);
        var jasperPrint = vm.jasperFillManager.fillReportSync(report.jasper, parameters, connection);
        return jasperPrint;
    } else {
        console.error("jasper not generated by previous process");
    }

    return null;
};

// Generate PDF From JasperPrint
function generatePDF(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".pdf";
    var jasperPrint = generateJasperPrint(report, jasperFile, outputFile);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperPdfExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleOutputStreamExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate HTML From JasperPrint
function generateHTML(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".html";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperHtmlExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleHtmlExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate RTF From JasperPrint
function generateRTF(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".rtf";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperRtfExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleWriterExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate CSV From JasperPrint
function generateCSV(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".csv";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperCsvExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleWriterExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate DocX From JasperPrint
function generateDOCX(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".docx";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperDocxExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleOutputStreamExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate PptX From JasperPrint
function generatePPTX(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".pptx";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperPptxExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleOutputStreamExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate XlsX From JasperPrint
function generateXLSX(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".xls";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperXlsxExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleOutputStreamExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Generate ODT From JasperPrint
function generateODT(report){
    var tmpFile = tmp.fileSync();
    var outputFile = tmpFile.name + ".odt";
    var jasperPrint = generateJasperPrint(report);
    if (jasperPrint){
        var jasperReportsContext = java.callStaticMethodSync("net.sf.jasperreports.engine.DefaultJasperReportsContext", "getInstance");
        var exporter = new vm.jasperOdtExporter(jasperReportsContext);
        exporter.setExporterInputSync(new vm.simpleExporterInput(jasperPrint));
        exporter.setExporterOutputSync(new vm.simpleOutputStreamExporterOutput(outputFile));
        exporter.exportReportSync();
    
        var toStream = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        return toStream; 
    }
    return null;
};

// Start Of Process
async.auto({
    getSettings: function(callback){
        console.log("get settings");
        vm.settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
        callback();
    },
    getJarsFromLib: ['getSettings', function(results, callback){
        var dir = vm.libraryPath;
        console.log("get jars from " + dir);
        var files = fs.readdirSync(dir);
        for (var file in files){
            file = path.join(dir, files[file]);
            var stat = fs.statSync(file);
            if (stat && stat.isDirectory()){
                // directory found, do not process
                console.log("found subdirectory " + file);
            } else {
                console.log("found file " + file);
                // Load Jar
                loadJar(file);
            }
        }       
        callback();
    }],
    loadSQLDrivers: ['getJarsFromLib', function(results, callback){    
        console.log("load sql drivers");
        var classLoader = java.callStaticMethodSync("java.lang.ClassLoader", "getSystemClassLoader");
        if (vm.settings.drivers){
            for (var name in vm.settings.drivers){
                var driver = vm.settings.drivers[name];            
                var file = path.join(vm.modulePath, driver.path);
                loadJar(file);
                classLoader.loadClassSync(driver.class).newInstanceSync();
            }        
        }
        callback();
    }],
    importJasper: ['loadSQLDrivers', function(results, callback){
        console.log("import jasper");        
        vm.driverManager = java.import("java.sql.DriverManager");
        vm.hashMap = java.import("java.util.HashMap");
        vm.locale = java.import("java.util.Locale");
        vm.byteAraryInputStream = java.import("java.io.ByteArrayInputStream");
        vm.jasperEmptyDataSource = java.import("net.sf.jasperreports.engine.JREmptyDataSource");
        vm.jasperCompileManager = java.import("net.sf.jasperreports.engine.JasperCompileManager");
        vm.jasperFillManager = java.import("net.sf.jasperreports.engine.JasperFillManager");
        vm.jasperExportManager = java.import("net.sf.jasperreports.engine.JasperExportManager");
        vm.jasperPdfExporter = java.import("net.sf.jasperreports.engine.export.JRPdfExporter");
        vm.jasperHtmlExporter = java.import("net.sf.jasperreports.engine.export.HtmlExporter");
        vm.jasperRtfExporter = java.import("net.sf.jasperreports.engine.export.JRRtfExporter");
        vm.jasperCsvExporter = java.import("net.sf.jasperreports.engine.export.JRCsvExporter");
        vm.jasperDocxExporter = java.import("net.sf.jasperreports.engine.export.ooxml.JRDocxExporter");
        vm.jasperPptxExporter = java.import("net.sf.jasperreports.engine.export.ooxml.JRPptxExporter");
        vm.jasperXlsxExporter = java.import("net.sf.jasperreports.engine.export.ooxml.JRXlsxExporter");
        vm.jasperOdtExporter = java.import("net.sf.jasperreports.engine.export.oasis.JROdtExporter");
        vm.jasperJsonExporter = java.import("net.sf.jasperreports.engine.export.JsonExporter");
        vm.simpleExporterInput = java.import("net.sf.jasperreports.export.SimpleExporterInput");
        vm.simpleOutputStreamExporterOutput = java.import("net.sf.jasperreports.export.SimpleOutputStreamExporterOutput");
        vm.simpleHtmlExporterOutput = java.import("net.sf.jasperreports.export.SimpleHtmlExporterOutput");
        vm.simpleWriterExporterOutput = java.import("net.sf.jasperreports.export.SimpleWriterExporterOutput");
        vm.jasperXmlLoader = java.import("net.sf.jasperreports.engine.xml.JRXmlLoader")
        callback();
    }]
},
function(error, results) {
    console.log("start express");
    // Start of Express     
    app.use(cors({ origin: true }));
    app.use(bodyParser.json());

    app.post("/generate_pdf", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generatePDF(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".pdf");
            res.contentType("application/pdf");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_html", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generateHTML(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".html");
            res.contentType("text/html");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_rtf", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generateRTF(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".rtf");
            res.contentType("application/rtf");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_csv", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generateCSV(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".csv");
            res.contentType("application/rtf");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_docx", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generateDOCX(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".docx");
            res.contentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_pptx", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generatePPTX(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".pptx");
            res.contentType("application/vnd.openxmlformats-officedocument.presentationml.presentation");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_xlsx", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generateXLSX(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".xlsx");
            res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });
    app.post("/generate_odt", function(req, res){
        var report = req.body;
        if (report){
            console.log(report);
            var obj = generateODT(report);            
            res.setHeader('Content-Disposition', 'attachment; filename=' + report.name + ".odt");
            res.contentType("application/vnd.oasis.opendocument.text");
            res.send(obj);
            return;
        } else {
            res.status(400).send("invalid parameters");
        }
        
    });

    console.log("Listening at port 3000");
    app.listen(3000, 'localhost');  
});




