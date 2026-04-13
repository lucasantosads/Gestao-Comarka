// File to test meta API creatives
import { metaFetchPaginated } from "./src/lib/meta-fetch.ts";

async function run() {
    const result = await metaFetchPaginated({
        endpoint: "ads",
        fields: "id,name,creative{thumbnail_url,image_url,video_id,body,title,object_story_spec}",
        params: { limit: "5" },
    });
    console.log(JSON.stringify(result.data, null, 2));
}

run().catch(console.error);
