import { HStack, Box } from "@chakra-ui/react";
import Menu from "@/components/menu";
import { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <HStack p="5" alignItems="flex-start" bgColor="blackAlpha.950">
      <Menu />
      <Box w="full" h="92vh">
        {children}
      </Box>
    </HStack>
  );
};

export default Layout;
