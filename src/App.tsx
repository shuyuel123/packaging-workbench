import { RouterProvider, createHashRouter } from "react-router-dom";
import { routes } from "./router";

// 使用「数据路由」创建 Hash 路由。
// 说明：AppLayout 依赖 useMatches + 路由 handle 生成面包屑，
// 而 useMatches 仅在数据路由（createXxxRouter + RouterProvider）下可用；
// 若继续使用 <HashRouter> + useRoutes，useMatches 会抛错导致整页白屏。
const router = createHashRouter(routes);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
