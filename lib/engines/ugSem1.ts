// This module intentionally mirrors the existing verified UG/BBA calculation files.
// The Admin Panel calls it; it does not invent a second calculation formula.
const GRACE_TOTAL_LIMIT = 8;
const GRACE_SUBJECT_LIMIT = 5;
const PASS_MARK = 40;
const GRACE_PRIORITY = [["Major CP 1"],["Major CP 2"],["Minor"],["MDC","MDE"],["AEC"],["VAC"]];

const UG_SUBJECT_MAP: Record<string, {category:string;credit:number}> = {
  "Core-1-Major-1": { category:"Major CP 1", credit:4 },
  "Core-1-Major-2": { category:"Major CP 2", credit:4 },
  "Core-2-Minor-1": { category:"Minor", credit:4 },
  "Multidisciplinary-1": { category:"MDC", credit:3 },
  "AEC-I": { category:"AEC", credit:4 },
  "VAC-I": { category:"VAC", credit:3 },
};
const BBA_SUBJECT_MAP: Record<string, {category:string;credit:number}> = {
  "CC-101": { category:"Major CP 1", credit:4 },
  "CC-102": { category:"Major CP 2", credit:4 },
  "CC-103": { category:"Minor", credit:4 },
  "MDE-101": { category:"MDE", credit:4 },
  "AEC-101": { category:"AEC", credit:4 },
  "AEC-102": { category:"AEC", credit:4 },
  "VAC-101": { category:"VAC", credit:3 },
};
const PRACTICAL_SUBJECTS = ["Biofertilizer & Biopesticides","Botany","C.PROG.","Chemistry","Climatology","Education","Geology","P.PROG.","Physics","Psychology","Zoology"];
function isPracticalSubject(subjectName: unknown) { return !!subjectName && PRACTICAL_SUBJECTS.some(name=>name.toLowerCase()===String(subjectName).trim().toLowerCase()); }
function getSubjectMap(student:any) { return String(student.Department||"").trim().toUpperCase()==="BBA" ? BBA_SUBJECT_MAP : UG_SUBJECT_MAP; }
function toNumber(value:any){ if(value===null||value===undefined||value==="") return 0; const n=Number(value); return Number.isNaN(n)?0:n; }
function calculateSubject(subject:any,isPractical:boolean){
  const midsemMark=toNumber(subject.MidsemMark), practical=toNumber(subject.PracticalMark), iPractical=toNumber(subject["I-Practical"]), attandance=toNumber(subject.Attandance), surpriseTest=toNumber(subject.SurpriseTest), assignment=toNumber(subject.Assignment), finalMark=toNumber(subject.FinalMark);
  let theory:number,totalMarks:number;
  if(isPractical){ theory=finalMark*50/100; totalMarks=theory+midsemMark+practical+attandance+iPractical+surpriseTest; }
  else { theory=finalMark*60/100; totalMarks=theory+midsemMark+attandance+surpriseTest+assignment; }
  return {subjectName:subject.subject,midsemMark,practical:isPractical?practical:"",iPractical:isPractical?iPractical:"",attandance,surpriseTest,assignment,finalMark,theory:Math.round(theory),totalMarks:Math.round(totalMarks),rawTheory:theory,rawTotalMarks:totalMarks,isPractical};
}
function applyGrace(subjects:any[]){
  let remainingGrace=GRACE_TOTAL_LIMIT;
  const results=subjects.map(subject=>({...subject,grace:0,finalTotal:subject.totalMarks}));
  for(const priorityCategories of GRACE_PRIORITY){
    const categorySubjects=results.filter(item=>priorityCategories.includes(item.category));
    for(const subject of categorySubjects){
      if(subject.totalMarks>=PASS_MARK) continue;
      const requiredGrace=PASS_MARK-subject.totalMarks;
      if(requiredGrace>GRACE_SUBJECT_LIMIT||requiredGrace>remainingGrace) continue;
      subject.grace=requiredGrace; subject.finalTotal=subject.totalMarks+requiredGrace; remainingGrace-=requiredGrace;
      if(remainingGrace===0) break;
    }
    if(remainingGrace===0) break;
  }
  return {subjects:results,usedGrace:GRACE_TOTAL_LIMIT-remainingGrace,remainingGrace};
}
function calculateGrade(marks:number){
  if(marks>=90&&marks<=100)return{grade:"O",gradePoint:10};
  if(marks>=80&&marks<=89)return{grade:"A+",gradePoint:9};
  if(marks>=70&&marks<=79)return{grade:"A",gradePoint:8};
  if(marks>=60&&marks<=69)return{grade:"B",gradePoint:7};
  if(marks>=45&&marks<=59)return{grade:"C",gradePoint:6};
  if(marks>=40&&marks<=44)return{grade:"D",gradePoint:5};
  return{grade:"F",gradePoint:0};
}
export function calculateUGStudent(student:any){
  const subjects=student.subjects||{}; const subjectMap=getSubjectMap(student); const calculatedSubjects:any[]=[];
  for(const [paperKey,subject] of Object.entries(subjects as Record<string,any>)){
    const subjectInfo=subjectMap[paperKey]; if(!subjectInfo) continue;
    const calculation=calculateSubject(subject,isPracticalSubject(subject.subject));
    calculatedSubjects.push({paperKey,category:subjectInfo.category,credit:subjectInfo.credit,...calculation});
  }
  const graceResult=applyGrace(calculatedSubjects);
  const finalSubjects=graceResult.subjects.map(subject=>{const g=calculateGrade(subject.finalTotal); return {...subject,grade:g.grade,gradePoint:g.gradePoint,creditPoint:subject.credit*g.gradePoint};});
  const totalCredits=finalSubjects.reduce((t,s)=>t+s.credit,0), totalCreditPoints=finalSubjects.reduce((t,s)=>t+s.creditPoint,0);
  return {student:{rollNo:student["Roll No"],autonomousRollNo:student["Autonomous Roll No"],examcode:student.Examcode,name:student["Name of the Students"],department:student.Department},courses:finalSubjects,totalCredits,totalCreditPoints,sgpa:totalCredits?Number((totalCreditPoints/totalCredits).toFixed(2)):0,usedGrace:graceResult.usedGrace,remainingGrace:graceResult.remainingGrace};
}
export {UG_SUBJECT_MAP,BBA_SUBJECT_MAP,PRACTICAL_SUBJECTS,isPracticalSubject};
