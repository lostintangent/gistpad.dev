import { layout, rootRoute, route } from "@tanstack/virtual-file-routes";

export default rootRoute("shell/__root.tsx", [
  layout("_authenticated", "features/account/routes/authenticated.tsx", [
    route("/{-$gistId}/{-$filePath}", "features/workbench/routes/index.tsx"),
    route("/new", "features/gists/routes/new.tsx"),
    route("/today", "features/gists/routes/today.tsx"),
  ]),
  route("/share/$gistId/{-$filePath}", "features/share/routes/index.tsx"),
]);
