Convex auth audit modules.

Current:

- base auth audit event builder with principal/resource attribution
- shared authorization-denied event builder
- specialized permission-denied and restriction-denied helpers built on shared denial shape
- denial metadata supports coarse `denialReason` plus exact `denialCode`
- machine and human principal support through shared principal-id mapping

Still needed for full runtime:

- opinionated event catalogs per app domain
- broader app-level adoption beyond current protected mutation paths
