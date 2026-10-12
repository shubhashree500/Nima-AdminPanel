const pg2025Sem1Config = {
  batch: "2025",
  programme: "PG",
  semester: 1,
  departments: {
    Odia: { papers: [
      { code:"1.1", title:"Puran o prachina kabya kabita", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.2", title:"Adhunika kabya kabita 1", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.3", title:"Katha sahitya", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.4", title:"Gadya sahitya", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 }
    ]},
    Chemistry: { papers: [
      { code:"1.1", title:"Inorganic chem 1", type:"theory", fullMark:70, midsemMax:20, endsemMax:50, credit:3 },
      { code:"1.2", title:"Organic chem 1", type:"theory", fullMark:70, midsemMax:20, endsemMax:50, credit:3 },
      { code:"1.3", title:"Physical chemistry 1", type:"theory", fullMark:70, midsemMax:20, endsemMax:50, credit:3 },
      { code:"1.4", title:"ICP-1", type:"practical", fullMark:50, midsemMax:0, endsemMax:50, credit:4 },
      { code:"1.5", title:"OCP-1", type:"practical", fullMark:50, midsemMax:0, endsemMax:50, credit:4 },
      { code:"1.6", title:"Spectroscopy 1", type:"theory", fullMark:70, midsemMax:20, endsemMax:50, credit:3 },
      { code:"1.7", title:"Computer for chemist", type:"theory", fullMark:70, midsemMax:20, endsemMax:50, credit:3 }
    ]},
    Math: { papers: [
      { code:"1.1", title:"Real analysis", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.2", title:"Complex analysis", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.3", title:"Topology", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.4", title:"Advance abstract algebra", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.5", title:"DPNCL", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 }
    ]},
    Commerce: { papers: [
      { code:"1.1", title:"Management concepts and practices", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.2", title:"Statistics for management", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.3", title:"Corporate financial accounting", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.4", title:"Financial management", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.5", title:"Accounting for managerial decision making", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.6", title:"Risk and insurance management", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 }
    ]},
    Geology: { papers: [
      { code:"1.1", title:"Crystallography, mineralogy and mineral optics", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.2", title:"Mineral deposits", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.3", title:"Applied economic geology, mineral economics and remote sensing", type:"theory", fullMark:100, midsemMax:30, endsemMax:70, credit:6 },
      { code:"1.4", title:"Practical corresponding to theory paper 1.1", type:"practical", fullMark:100, midsemMax:0, endsemMax:100, credit:6 },
      { code:"1.5", title:"Practicals corresponding to theory papers 1.2 & 1.3", type:"practical", fullMark:100, midsemMax:0, endsemMax:100, credit:6 }
    ]},
    MFC: { papers: [] }
  },
  grading: {
    scale: [
      { minPercentage:90, maxPercentage:100, grade:"O", gradePoint:10 },
      { minPercentage:80, maxPercentage:89, grade:"A+", gradePoint:9 },
      { minPercentage:70, maxPercentage:79, grade:"A", gradePoint:8 },
      { minPercentage:60, maxPercentage:69, grade:"B+", gradePoint:7 },
      { minPercentage:50, maxPercentage:59, grade:"B", gradePoint:6 },
      { minPercentage:45, maxPercentage:49, grade:"C", gradePoint:5 },
      { minPercentage:40, maxPercentage:44, grade:"D", gradePoint:4 },
      { minPercentage:0, maxPercentage:39, grade:"F", gradePoint:0 }
    ],
    specialGrades: { AB:{grade:"AB",gradePoint:0}, M:{grade:"M",gradePoint:0} }
  },
  calculation: {
    totalMark:"midsemMark + finalMark",
    percentage:"(totalMark / fullMark) * 100",
    creditPoint:"credit * gradePoint",
    sgpa:"sum(creditPoint) / sum(credit)",
    semesterPercentage:"(sum(totalMark) / sum(fullMark)) * 100"
  }
};
module.exports = pg2025Sem1Config;
