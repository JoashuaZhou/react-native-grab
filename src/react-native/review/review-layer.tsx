import { useEffect } from "react";
import { reviewActions } from "./store";
import { ReviewComposer } from "./composer";
import { ReviewListPanel } from "./list-panel";

export const ReviewLayer = () => {
  useEffect(() => {
    // Restores a pairing code stored by an earlier session; without this
    // initial refresh the store stays unpaired until the list is opened.
    void reviewActions.refresh();
  }, []);

  return (
    <>
      <ReviewComposer />
      <ReviewListPanel />
    </>
  );
};
