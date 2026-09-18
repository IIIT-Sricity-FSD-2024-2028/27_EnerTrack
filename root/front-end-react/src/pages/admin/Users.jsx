import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../api/client";
import { AuthContext } from "../../auth/context";
import { UsersContext } from "./users/UsersContext";
import { UserFormModal, DeleteUserModal, ActAsModal } from "./users/UserModals";
import { USER_ROLES, STAFF_FILTER_VALUE, applyFiltersAndSort, formatLabel, isSameUser, loadFilters, orgName, saveFilters } from "./users/userHelpers";
import "../../styles/system_admin/system_admin_overview.css";
function fetchUsersAndOrganizations() {
  return Promise.all([api.get("/users"),api.get("/organizations").catch(()=>[])]);
}
export default function AdminUsers() {
  const { user:sessionUser }=useContext(AuthContext);
  const isSuperAdmin=sessionUser?.role==="Super Admin";
  const [users,setUsers]=useState([]);
  const [organizations,setOrganizations]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState(loadFilters);
  const [modal,setModal]=useState(null);
  const [toasts,setToasts]=useState([]);
  const [redirectTo,setRedirectTo]=useState(null);
  function showToast(message,type="info",duration=3000) {
    const id=Date.now()+Math.random();
    setToasts((prev)=>[...prev,{ id, message, type }]);
    setTimeout(()=>{
      setToasts((prev)=>prev.filter((toast)=>toast.id!==id));
    },duration);
  }
  function closeModal() {
    setModal(null);
  }
  function reload() {
    return fetchUsersAndOrganizations()
      .then(([nextUsers,nextOrganizations])=>{
        setUsers(Array.isArray(nextUsers)?nextUsers:[]);
        setOrganizations(Array.isArray(nextOrganizations)?nextOrganizations:[]);
      })
      .catch((err)=>{
        console.error("Failed to load from backend:",err);
        showToast(err.message||"Failed to load data from backend.","error");
      })
      .finally(()=>setLoading(false));
  }
  useEffect(()=>{
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    saveFilters(filters);
  },[filters]);
  function handleDelete(user) {
    if (isSameUser(sessionUser,user.user_id)) {
      showToast("You cannot delete your own account.","error");
      return;
    }
    setModal({ type:"delete", user });
  }
  if (redirectTo) return <Navigate to={redirectTo} />;
  const rows=applyFiltersAndSort(users,filters,organizations);
  const filtersActive=filters.organization_id||filters.role;
  const firstName=sessionUser?.name?.split(" ")[0]||"Admin";
  const contextValue={ users, organizations, isSuperAdmin, reload, showToast, closeModal, setRedirectTo };
  return (
    <UsersContext.Provider value={contextValue}>
      <header className="page-header">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>Manage campus users, roles, and login access.</p>
        </div>
      </header>
      <section className="admin-app" aria-live="polite">
        {loading?(
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80, flexDirection:"column", gap:16, color:"#6b7280" }}>
            <div style={{ width:36, height:36, border:"3px solid #e5e7eb", borderTopColor:"#111827", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            <p style={{ fontSize:14, fontWeight:500 }}>Loading from backend…</p>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ):(
          <section className="dashboard-section">
            <div className="section-toolbar">
              <div>
                <h2>User Management</h2>
                <p>Uses the backend User table shape: user_id, name, email, phone, password, role, specialization.</p>
              </div>
              <button className="btn-dark" type="button" onClick={()=>setModal({ type:"add", user:null })}>Add User</button>
            </div>
            <div className="table-card" style={{ padding:"16px 20px", marginBottom:16, display:"flex", gap:16, alignItems:"flex-end", flexWrap:"wrap" }}>
              {isSuperAdmin?(
                <div className="form-field" style={{ marginBottom:0, minWidth:200 }}>
                  <label htmlFor="userFilterOrg">Organisation</label>
                  <select id="userFilterOrg" value={filters.organization_id} onChange={(e)=>setFilters({ ...filters, organization_id:e.target.value })}>
                    <option value="">All organisations</option>
                    <option value={STAFF_FILTER_VALUE}>EnerTrack Staff</option>
                    {organizations.map((o)=>(<option key={o.organization_id} value={o.organization_id}>{o.name}</option>))}
                  </select>
                </div>
              ):null}
              <div className="form-field" style={{ marginBottom:0, minWidth:180 }}>
                <label htmlFor="userFilterRole">Role</label>
                <select id="userFilterRole" value={filters.role} onChange={(e)=>setFilters({ ...filters, role:e.target.value })}>
                  <option value="">All roles</option>
                  {USER_ROLES.map((role)=>(<option key={role} value={role}>{role}</option>))}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom:0, minWidth:180 }}>
                <label htmlFor="userSort">Sort by</label>
                <select id="userSort" value={filters.sort} onChange={(e)=>setFilters({ ...filters, sort:e.target.value })}>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                  <option value="org">Organisation</option>
                  <option value="role">Role</option>
                </select>
              </div>
              {filtersActive?(<button className="btn-outline" type="button" onClick={()=>setFilters({ organization_id:"", role:"", sort:filters.sort })}>Clear filters</button>):null}
              <span className="muted-cell" style={{ marginLeft:"auto" }}>Showing {rows.length} of {users.length}</span>
            </div>
            <div className="table-card">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Organisation</th>
                      <th>Role</th>
                      <th>Specialization</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length===0?(
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">{filtersActive?"No users match these filters.":"No users found."}</div>
                        </td>
                      </tr>
                    ):(
                      rows.map((user)=>{
                        const isCurrentUser=isSameUser(sessionUser,user.user_id);
                        return (
                          <tr key={user.user_id}>
                            <td>
                              <strong>{user.name}</strong>
                              <div className="muted-cell">{user.user_id}</div>
                            </td>
                            <td>{user.email}</td>
                            <td>{user.phone||"-"}</td>
                            <td>{orgName(user.organization_id,organizations)}</td>
                            <td>{formatLabel(user.role)}</td>
                            <td>{user.specialization||"-"}</td>
                            <td>
                              <div className="row-actions">
                                {isSuperAdmin&&!isCurrentUser?(<button className="btn-outline" type="button" title="Open the product as this user sees it" onClick={()=>setModal({ type:"actAs", user })}>Act as</button>):null}
                                <button className="btn-outline" type="button" onClick={()=>setModal({ type:"edit", user })}>Edit</button>
                                <button className="btn-outline btn-danger" type="button" disabled={isCurrentUser} title={isCurrentUser?"You cannot delete your own account":undefined} onClick={()=>handleDelete(user)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </section>
      {modal?.type==="add"||modal?.type==="edit"?<UserFormModal user={modal.user} />:null}
      {modal?.type==="delete"?<DeleteUserModal user={modal.user} />:null}
      {modal?.type==="actAs"?<ActAsModal user={modal.user} />:null}
      {toasts.length>0?(
        <div className="toast-stack">
          {toasts.map((toast)=>(<div key={toast.id} className={`toast ${toast.type}`}>{toast.message}</div>))}
        </div>
      ):null}
    </UsersContext.Provider>
  );
}
