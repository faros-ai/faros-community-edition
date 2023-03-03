import { useState, useEffect } from 'react';
import React from 'react';
import { Typography, Grid } from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { LazyLog,ScrollFollow } from "react-lazylog";

// Note: This line relies on Docker Desktop's presence as a host application.
// If you're running this React app in a browser, it won't work properly.
const client = createDockerDesktopClient();

function useDockerDesktopClient() {
  return client;
}

export function App() {
  const [state, setState] = React.useState<string>();
  const [logs, setLogs] = useState<string>("Fetching Faros init logs...");
  const ddClient = useDockerDesktopClient();

  useEffect(() => {
    const checkIfFarosIsReady = async () => {
      const farosInitlog = await ddClient.docker.cli.exec("logs", [
        "--tail",
        "100",
        "faros-init"
      ]);
      if (farosInitlog.stderr !== "") {
        ddClient.desktopUI.toast.error(farosInitlog.stderr);
      } else {
        setLogs(farosInitlog.stdout);
      }
    }
    let timer = setInterval(() => {
      checkIfFarosIsReady();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Grid container flex={1} direction="column" spacing={4}>
      <Grid item justifyContent="center" textAlign="center" minHeight="100px">
        {
          <>
            <Typography mt={2}>
              Faros Status
            </Typography>
            <br/>
            <div style={{ "textAlign": 'left', "height": 400, "width": "100%" }}>
              <ScrollFollow
                startFollowing
                render={({ onScroll, follow, startFollowing, stopFollowing }) => (
                  <LazyLog text={logs} stream follow={follow} />
                )}
              />
            </div>
          </>
        }
      </Grid>
    </Grid>
  );
}
