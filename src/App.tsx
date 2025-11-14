import { TooltipProvider } from "@/components/ui/tooltip";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Index from "./pages/Index";
import New from "./pages/New";
import NotFound from "./pages/NotFound";
import Share from "./pages/Share";
import Today from "./pages/Today";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 5, // 5 days
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: "gistpad-data-cache",
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister }}
  >
    <TooltipProvider>
      <Toaster />
      <HashRouter>
        <Routes>
          <Route path="/today" element={<Today />} />
          <Route path="/new" element={<New />} />
          <Route path="/share/:gistId/:filePath?" element={<Share />} />
          <Route path="/:gistId?/:filePath?" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
