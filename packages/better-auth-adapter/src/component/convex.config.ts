import { defineComponent } from "convex/server";
import migrations from "@convex-dev/migrations/convex.config.js";

const component = defineComponent("betterAuth");
component.use(migrations, { name: "migrations" });

export default component;
