import { useContext, useEffect, useState } from "react";
import api from "../../../api/client";
import { AuthContext } from "../../../auth/context";
import { homeForRole } from "../../../routes";
import { UsersContext } from "./UsersContext";
import { USER_ROLES, PLATFORM_SIDE_ROLES, buildPayload, formatLabel, isSameUser, validateUser } from "./userHelpers";
function ModalShell({ title, confirmLabel, danger=false, onConfirm, children }) {
  const { closeModal }=useContext(UsersContext);
  useEffect(()=>{
    function handleKeydown(event) {
      if (event.key==="Escape") closeModal();
    }
    document.addEventListener("keydown",handleKeydown);
    return ()=>document.removeEventListener("keydown",handleKeydown);
  },[closeModal]);
  return (
    <div className="modal-overlay" onClick={(event)=>{ if (event.target===event.currentTarget) closeModal(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="modal-header">
          <h2 id="modalTitle">{title}</h2>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={closeModal}>Cancel</button>
          <button className={danger?"btn-dark btn-danger-fill":"btn-dark"} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
export function UserFormModal({ user }) {
  const { users, organizations, isSuperAdmin, reload, showToast, closeModal }=useContext(UsersContext);
  const { user:sessionUser, adoptSession }=useContext(AuthContext);
  const isEdit=Boolean(user);
  const [values,setValues]=useState({
    name:user?.name||"",
    email:user?.email||"",
    phone:user?.phone||"",
    role:user?.role||USER_ROLES[0],
    organization_id:"",
    specialization:user?.specialization||"",
    password:user?.password||"",
  });
  const [errors,setErrors]=useState({});
  const needsOrgPicker=isEdit?isSuperAdmin&&!user.organization_id&&!PLATFORM_SIDE_ROLES.includes(user.role):isSuperAdmin;
  const showOrgPicker=needsOrgPicker&&(isEdit||!PLATFORM_SIDE_ROLES.includes(values.role));
  function setField(field,value) {
    setValues({ ...values, [field]:value });
  }
  async function handleConfirm() {
    const trimmed=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()]));
    const nextErrors=validateUser(trimmed,users,{ editingId:isEdit?user.user_id:null, requireOrg:showOrgPicker });
    if (Object.keys(nextErrors).length>0) {
      setErrors(nextErrors);
      return;
    }
    closeModal();
    const payload=buildPayload(trimmed);
    if (showOrgPicker) payload.organization_id=trimmed.organization_id;
    try {
      if (isEdit) {
        await api.patch("/users/"+user.user_id,payload);
        if (isSameUser(sessionUser,user.user_id)) adoptSession({ ...sessionUser, ...payload });
      } else {
        await api.post("/users",payload);
      }
      await reload();
      showToast(isEdit?`Updated ${trimmed.name}.`:`Added ${trimmed.name}.`,"success");
    } catch (err) {
      console.error(err);
      showToast(err.message||"Could not save the user.","error");
    }
  }
  const prefix=isEdit?"editUser":"user";
  return (
    <ModalShell title={isEdit?"Edit User":"Add User"} confirmLabel={isEdit?"Save Changes":"Add User"} onConfirm={handleConfirm}>
      <form className="form-grid" onSubmit={(event)=>event.preventDefault()}>
        <div className="form-field">
          <label htmlFor={`${prefix}Name`}>Name</label>
          <input id={`${prefix}Name`} autoComplete="name" placeholder={isEdit?undefined:"Teja Rao"} autoFocus value={values.name} onChange={(e)=>setField("name",e.target.value)} />
          <span className="field-error">{errors.name}</span>
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}Email`}>Email</label>
          <input id={`${prefix}Email`} autoComplete="email" placeholder={isEdit?undefined:"name@example.com"} value={values.email} onChange={(e)=>setField("email",e.target.value)} />
          <span className="field-error">{errors.email}</span>
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}Phone`}>Phone</label>
          <input id={`${prefix}Phone`} autoComplete="tel" placeholder={isEdit?undefined:"9876543210"} value={values.phone} onChange={(e)=>setField("phone",e.target.value)} />
          <span className="field-error">{errors.phone}</span>
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}Role`}>Role</label>
          <select id={`${prefix}Role`} value={values.role} onChange={(e)=>setField("role",e.target.value)}>
            {USER_ROLES.map((role)=>(<option key={role} value={role}>{role}</option>))}
          </select>
          <span className="field-error">{errors.role}</span>
        </div>
        {showOrgPicker?(
          <div className="form-field">
            <label htmlFor={`${prefix}Org`}>Organisation</label>
            <select id={`${prefix}Org`} value={values.organization_id} onChange={(e)=>setField("organization_id",e.target.value)}>
              <option value="" disabled hidden>Select an organisation</option>
              {organizations.map((o)=>(<option key={o.organization_id} value={o.organization_id}>{o.name}</option>))}
            </select>
            <span className="field-error">{errors.organization_id}</span>
            {isEdit?(<p className="muted-cell" style={{ marginTop:6 }}>This account has no organisation. Pick one to link it — this can only be done once.</p>):null}
          </div>
        ):null}
        <div className="form-field">
          <label htmlFor={isEdit?"editSpecialization":"specialization"}>Specialization</label>
          <input id={isEdit?"editSpecialization":"specialization"} placeholder="Required for Technicians" value={values.specialization} onChange={(e)=>setField("specialization",e.target.value)} />
          <span className="field-error">{errors.specialization}</span>
        </div>
        <div className="form-field">
          <label htmlFor={isEdit?"editPassword":"tempPassword"}>{isEdit?"Password":"Temporary Password"}</label>
          <input id={isEdit?"editPassword":"tempPassword"} type="password" autoComplete="new-password" placeholder="Minimum 8 characters" value={values.password} onChange={(e)=>setField("password",e.target.value)} />
          <span className="field-error">{errors.password}</span>
        </div>
      </form>
    </ModalShell>
  );
}
export function DeleteUserModal({ user }) {
  const { reload, showToast, closeModal }=useContext(UsersContext);
  async function handleConfirm() {
    closeModal();
    try {
      await api.delete("/users/"+user.user_id);
      await reload();
      showToast(`Deleted ${user.name}.`,"success");
    } catch (err) {
      console.error(err);
      showToast(err.message||"Could not delete the user.","error");
    }
  }
  return (
    <ModalShell title="Delete User" confirmLabel="Delete" danger onConfirm={handleConfirm}>
      <p>Delete <strong>{user.name}</strong> from the User mock table?</p>
    </ModalShell>
  );
}
export function ActAsModal({ user }) {
  const { showToast, closeModal, setRedirectTo }=useContext(UsersContext);
  const { impersonate }=useContext(AuthContext);
  async function handleConfirm() {
    closeModal();
    try {
      const session=await impersonate(user.user_id);
      setRedirectTo(homeForRole(session.role));
    } catch (err) {
      console.error("Impersonation failed:",err);
      showToast(err.message||"Could not act as that user.","error");
    }
  }
  return (
    <ModalShell title="Act as another user" confirmLabel="Act as this user" onConfirm={handleConfirm}>
      <p>Open EnerTrack as <strong>{user.name}</strong> ({formatLabel(user.role)})?</p>
      <p className="muted-cell">You will see exactly what they see, and anything you do will be done as them. A banner stays on screen with a way back, and the switch is recorded in the activity log.</p>
    </ModalShell>
  );
}
