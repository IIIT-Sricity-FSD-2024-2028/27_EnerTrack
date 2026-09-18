export const USER_ROLES=["Organization Admin","Financial Analyst","Technician","Technician Administrator","Sustainability Officer","Campus Visitor","Certified Energy Auditor"];
export const PLATFORM_SIDE_ROLES=["Certified Energy Auditor"];
export const STAFF_FILTER_VALUE="__enertrack_staff__";
const FILTERS_STORAGE_KEY="admin_userFilters";
const DEFAULT_FILTERS={ organization_id:"", role:"", sort:"name-asc" };
export function loadFilters() {
  try {
    const saved=JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY)||"null");
    if (saved&&typeof saved==="object") {
      return { organization_id:saved.organization_id||"", role:saved.role||"", sort:saved.sort||"name-asc" };
    }
  } catch {
    return DEFAULT_FILTERS;
  }
  return DEFAULT_FILTERS;
}
export function saveFilters(filters) {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY,JSON.stringify(filters));
  } catch {
    return;
  }
}
export function formatLabel(value) {
  const labels={
    systemAdministrator:"Organization Admin",
    financeAnalyst:"Finance Analyst",
    sustainabilityOfficer:"Sustainability Officer",
    technicianAdministrator:"Technician Administrator",
    technician:"Technician",
    campusVisitor:"Campus Visitor",
  };
  return labels[value]||value;
}
export function orgName(id,organizations) {
  if (!id) return "EnerTrack (staff)";
  const org=organizations.find((o)=>o.organization_id===id);
  return org?org.name:id;
}
export function isSameUser(sessionUser,userId) {
  if (!sessionUser) return false;
  return sessionUser.user_id===userId||sessionUser.id===userId;
}
export function isTechnicianRole(role) {
  return role==="Technician"||role==="Technician Administrator";
}
export function applyFiltersAndSort(users,filters,organizations) {
  const rows=users.filter((u)=>{
    if (filters.organization_id===STAFF_FILTER_VALUE) {
      if (u.organization_id) return false;
    } else if (filters.organization_id&&u.organization_id!==filters.organization_id) {
      return false;
    }
    if (filters.role&&u.role!==filters.role) return false;
    return true;
  });
  const byName=(a,b)=>a.name.localeCompare(b.name);
  return [...rows].sort((a,b)=>{
    switch (filters.sort) {
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "org":
        return orgName(a.organization_id,organizations).localeCompare(orgName(b.organization_id,organizations))||byName(a,b);
      case "role":
        return formatLabel(a.role).localeCompare(formatLabel(b.role))||byName(a,b);
      case "name-asc":
      default:
        return byName(a,b);
    }
  });
}
export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function getPhoneValidationError(phone) {
  const normalizedPhone=String(phone||"").trim();
  if (normalizedPhone.length===0) return "Phone number is required.";
  if (!/^[0-9]+$/.test(normalizedPhone)) return "Only digits are allowed.";
  if (normalizedPhone.length!==10) return "Phone number must be exactly 10 digits.";
  if (normalizedPhone==="0000000000") return "Phone number cannot be all zeros.";
  if (/^(\d)\1{9}$/.test(normalizedPhone)) return "Phone number cannot repeat the same digit.";
  return "";
}
export function validateUser(values,existingUsers,options={}) {
  const { editingId=null, requireOrg=false }=options;
  const errors={};
  const others=existingUsers.filter((user)=>user.user_id!==editingId);
  if (requireOrg&&!values.organization_id) {
    errors.organization_id=editingId?"Select an organisation to link this account to.":"Select which organisation this user belongs to.";
  }
  if (!values.name||values.name.length<2) errors.name="Enter a name with at least 2 characters.";
  if (!values.email) errors.email="Email is required.";
  else if (!isEmail(values.email)) errors.email="Enter a valid email address.";
  else if (others.some((user)=>user.email.toLowerCase()===values.email.toLowerCase())) {
    errors.email="A user with this email already exists.";
  }
  const phoneError=getPhoneValidationError(values.phone);
  if (phoneError) errors.phone=phoneError;
  if (!errors.phone&&others.some((user)=>user.phone&&user.phone===values.phone.trim())) {
    errors.phone="A user with this phone number already exists.";
  }
  if (!USER_ROLES.includes(values.role)) errors.role="Select a valid DB role.";
  if (isTechnicianRole(values.role)&&values.specialization.length<2) {
    errors.specialization="Technician specialization is required.";
  }
  if (!values.password||values.password.length<8) {
    errors.password=editingId?"Password must be at least 8 characters.":"Temporary password must be at least 8 characters.";
  }
  return errors;
}
export function buildPayload(values) {
  return {
    name:values.name,
    email:values.email.toLowerCase(),
    phone:values.phone.trim(),
    password:values.password,
    role:values.role,
    specialization:isTechnicianRole(values.role)?values.specialization:null,
  };
}
