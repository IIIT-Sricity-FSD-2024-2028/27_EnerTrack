/**
 * files.js: fetch a protected file (a receipt, a photo) as a blob URL.
 *
 * Files need the sign-in token, so a bare <img src> or <iframe src> cannot
 * load them. The URL is a one-off value for the component that shows it, not
 * app data, so nothing is stored; the component revokes it when done.
 *
 *   const url = await dispatch(fetchFileUrl("/expense-bills/x/attachments/y")).unwrap();
 */
import api from "../api/client";
import { apiThunk } from "./apiThunk";

export const fetchFileUrl = apiThunk("files/fetchUrl", (path) => api.getBlobUrl(path));
